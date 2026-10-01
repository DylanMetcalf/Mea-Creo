import { and, eq, gte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { agentRuns, clients } from "@/db/schema";
import { estimateCostMicroUsd } from "@/integrations/ai/pricing";
import { resolveIntegration } from "@/integrations/registry";
import { logger } from "@/lib/logger";
import { getPlatformSetting } from "@/modules/settings/service";
import { type AgentAction, agentCan, getAgent } from "./registry";

export interface AgentCall {
  agent: string;
  action: AgentAction;
  organisationId: string | null;
  runId?: string | null;
  /** Recorded for traceability (ids and summaries, not whole records). */
  input: Record<string, unknown>;
  /** Optional LLM step. When omitted, or no AI provider is configured, `rules` produces the output. */
  prompt?: { system: string; user: string; maxTokens?: number };
  /** Deterministic implementation. Always available, so the system works without AI. */
  rules: () => string | Promise<string>;
}

export interface AgentOutcome {
  status: "succeeded" | "blocked" | "failed";
  text: string;
  source: "ai" | "rules";
  reason?: string;
  costMicroUsd: number;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function monthSpendMicroUsd(db: DbOrTx, organisationId?: string | null): Promise<number> {
  const conditions = [gte(agentRuns.createdAt, startOfMonth())];
  if (organisationId) conditions.push(eq(agentRuns.organisationId, organisationId));
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}), 0)::bigint` })
    .from(agentRuns)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

/** Checks emergency controls and budgets. Returns a reason when the agent must not run. */
export async function agentBlockReason(
  db: DbOrTx,
  agentId: string,
  organisationId: string | null,
): Promise<string | null> {
  const emergency = await getPlatformSetting(db, "emergency");
  if (emergency.pauseAllAutomation) return "All automation is paused (emergency control).";
  if (emergency.pausedAgents.includes(agentId)) return `${getAgent(agentId).name} is paused.`;
  if (organisationId) {
    const [client] = await db
      .select({ paused: clients.automationPaused, billing: clients.billingState })
      .from(clients)
      .where(eq(clients.organisationId, organisationId))
      .limit(1);
    if (client?.paused) return "Automation is paused for this client.";
    if (client && (client.billing === "overdue" || client.billing === "suspended"))
      return "Automated work is paused while the account is overdue.";
  }
  return null;
}

/**
 * Runs one agent action with permission checks, emergency controls, budgets, cost
 * tracking and a full audit record. Never throws for expected blocks.
 */
export async function runAgent(db: DbOrTx, call: AgentCall): Promise<AgentOutcome> {
  const agent = getAgent(call.agent);
  const started = Date.now();
  const record = async (
    outcome: AgentOutcome,
    extra: Partial<typeof agentRuns.$inferInsert> = {},
  ) => {
    await db.insert(agentRuns).values({
      organisationId: call.organisationId,
      runId: call.runId ?? null,
      agent: agent.id,
      action: call.action,
      promptVersion: agent.promptVersion,
      input: call.input,
      output: outcome.text ? { text: outcome.text.slice(0, 20_000), source: outcome.source } : null,
      status: outcome.status,
      error: outcome.reason ?? null,
      durationMs: Date.now() - started,
      costMicroUsd: outcome.costMicroUsd,
      ...extra,
    });
    return outcome;
  };

  if (!agentCan(agent.id, call.action)) {
    return record({
      status: "blocked",
      text: "",
      source: "rules",
      reason: `${agent.name} is not permitted to ${call.action}.`,
      costMicroUsd: 0,
    });
  }
  const blocked = await agentBlockReason(db, agent.id, call.organisationId);
  if (blocked)
    return record({
      status: "blocked",
      text: "",
      source: "rules",
      reason: blocked,
      costMicroUsd: 0,
    });

  const ai = resolveIntegration("ai");
  const useAi = Boolean(call.prompt && ai.available && !ai.adapter.isMock);

  if (useAi && ai.available) {
    const aiSettings = await getPlatformSetting(db, "ai");
    const [globalSpend, clientSpend] = await Promise.all([
      monthSpendMicroUsd(db),
      call.organisationId ? monthSpendMicroUsd(db, call.organisationId) : Promise.resolve(0),
    ]);
    const overGlobal = globalSpend >= aiSettings.monthlyBudgetUsd * 1_000_000;
    const overClient =
      call.organisationId && clientSpend >= aiSettings.perClientMonthlyBudgetUsd * 1_000_000;
    if (!overGlobal && !overClient) {
      try {
        const result = await ai.adapter.generate({
          system: call.prompt!.system,
          messages: [{ role: "user", content: call.prompt!.user }],
          maxTokens: call.prompt!.maxTokens ?? 2000,
          effort: agent.effort,
          timeoutMs: 90_000,
        });
        const cost = estimateCostMicroUsd(
          result.model,
          result.usage.inputTokens,
          result.usage.outputTokens,
        );
        if (result.stopReason !== "refusal" && result.text) {
          return record(
            { status: "succeeded", text: result.text, source: "ai", costMicroUsd: cost },
            {
              provider: ai.adapter.provider,
              model: result.model,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
            },
          );
        }
        logger.warn({ agent: agent.id }, "AI declined or returned empty output; using rules");
      } catch (error) {
        logger.warn(
          { agent: agent.id, err: error instanceof Error ? error.message : String(error) },
          "AI call failed; using rules",
        );
      }
    } else {
      logger.info({ agent: agent.id }, "AI budget reached; using rules");
    }
  }

  try {
    const text = await call.rules();
    return record(
      { status: "succeeded", text, source: "rules", costMicroUsd: 0 },
      { provider: "rules" },
    );
  } catch (error) {
    return record({
      status: "failed",
      text: "",
      source: "rules",
      reason: error instanceof Error ? error.message : String(error),
      costMicroUsd: 0,
    });
  }
}

export { monthSpendMicroUsd };
