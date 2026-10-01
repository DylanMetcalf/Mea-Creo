import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { Pause, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Progress,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { AGENTS } from "@/agents/registry";
import { getDb } from "@/db";
import { agentRuns, clients, organisations, runs } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { formatMicroUsd } from "@/integrations/ai/pricing";
import { fmtRelative } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { RUN_KINDS } from "@/modules/runs/kinds";
import { getPlatformSetting } from "@/modules/settings/service";
import { runClientAction } from "../clients/actions";
import { toggleAgentAction } from "./actions";

export const metadata: Metadata = { title: "Runs & agents" };

export default async function RunsPage() {
  const ctx = await requireStaff();
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const inScope = scope === "all" ? undefined : inArray(runs.organisationId, scope);
  const [runRows, clientRows, perAgent, aiSettings, emergency] = await Promise.all([
    db
      .select({ r: runs, org: organisations.name })
      .from(runs)
      .innerJoin(organisations, eq(organisations.id, runs.organisationId))
      .where(inScope)
      .orderBy(desc(runs.createdAt))
      .limit(50),
    db
      .select({ id: clients.organisationId, name: clients.name })
      .from(clients)
      .where(
        and(
          ne(clients.lifecycle, "offboarded"),
          scope === "all" ? undefined : inArray(clients.organisationId, scope),
        ),
      )
      .orderBy(asc(clients.name)),
    db
      .select({
        agent: agentRuns.agent,
        calls: sql<number>`count(*)::int`,
        cost: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}),0)::bigint`,
        failed: sql<number>`count(*) filter (where ${agentRuns.status} in ('failed','blocked'))::int`,
      })
      .from(agentRuns)
      .where(gte(agentRuns.createdAt, monthStart))
      .groupBy(agentRuns.agent),
    getPlatformSetting(db, "ai"),
    getPlatformSetting(db, "emergency"),
  ]);
  const ai = resolveIntegration("ai");
  const realAi = ai.available && !ai.adapter.isMock;
  const usage = new Map(perAgent.map((a) => [a.agent, a]));
  const spent = perAgent.reduce((s, a) => s + Number(a.cost), 0);
  const budget = aiSettings.monthlyBudgetUsd * 1_000_000;

  return (
    <>
      <PageHeader
        title="Runs & agents"
        description="Every RUN button, every agent action and what it cost. Agents draft and recommend; the approval engine decides what needs a person."
      />
      {!realAi && (
        <div className="mb-6">
          <Callout tone="info" title="AI provider: not connected">
            Agents run in rules mode: deterministic, explainable checks with no AI-written text. Add
            an Anthropic API key to enable AI drafting. REQUIRES CONFIGURATION.
          </Callout>
        </div>
      )}
      {emergency.pauseAllAutomation && (
        <div className="mb-6">
          <Callout tone="danger" title="All automation is paused">
            Runs and agents won&apos;t act until resumed in Settings → Emergency controls.
          </Callout>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent runs" />
            <ul className="divide-border divide-y">
              {runRows.length === 0 && (
                <li className="text-muted px-5 py-4 text-sm">No runs yet.</li>
              )}
              {runRows.map(({ r, org }) => (
                <li key={r.id}>
                  <Link
                    href={`/workspace/runs/${r.id}`}
                    className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {RUN_KINDS[r.kind as keyof typeof RUN_KINDS]?.label ?? r.kind}
                      </span>
                      <span className="text-muted block text-xs">
                        {org} · {r.trigger} · {fmtRelative(r.createdAt)}
                        {r.summary
                          ? ` · ${r.summary.counts.requires_approval} for approval, ${r.summary.counts.recommended} recommended`
                          : ""}
                        {r.costMicroUsd > 0 ? ` · ${formatMicroUsd(r.costMicroUsd)}` : ""}
                      </span>
                    </span>
                    <StatusBadge kind="run" value={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              title="Agents"
              description="This month's activity. Each agent can only take the actions listed for it."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs">
                  <tr className="border-border border-b">
                    <th className="px-5 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                    <th className="px-3 py-2 text-right font-medium">Failed/blocked</th>
                    <th className="px-3 py-2 text-right font-medium">AI cost</th>
                    <th className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((a) => {
                    const u = usage.get(a.id);
                    const paused = emergency.pausedAgents.includes(a.id);
                    return (
                      <tr key={a.id} className="border-border border-b align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{a.name}</p>
                          <p className="text-muted max-w-md text-xs">{a.purpose}</p>
                          <details className="mt-1 text-xs">
                            <summary className="text-brand-700 cursor-pointer">Permissions</summary>
                            <p className="text-ink-soft mt-1">Can: {a.permissions.join(", ")}</p>
                            <p className="text-ink-soft">Never: {a.never.join(", ")}</p>
                          </details>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{u?.calls ?? 0}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{u?.failed ?? 0}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatMicroUsd(Number(u?.cost ?? 0))}
                        </td>
                        <td className="px-3 py-3">
                          {a.status === "planned" ? (
                            <Badge tone="neutral">Planned</Badge>
                          ) : ctx.can("emergency.controls") ? (
                            <form action={toggleAgentAction.bind(null, a.id)}>
                              <SubmitButton size="sm" variant={paused ? "primary" : "ghost"}>
                                {paused ? (
                                  <Play className="size-3.5" aria-hidden />
                                ) : (
                                  <Pause className="size-3.5" aria-hidden />
                                )}{" "}
                                {paused ? "Resume" : "Pause"}
                              </SubmitButton>
                            </form>
                          ) : (
                            <Badge tone={paused ? "warning" : "success"}>
                              {paused ? "Paused" : "Active"}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          {ctx.can("runs.execute") && (
            <Card>
              <CardHeader title="Start a run" />
              <CardBody>
                <form action={runClientAction} className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Client</span>
                    <select
                      name="organisationId"
                      className="border-border-strong bg-surface h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      {clientRows.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Run</span>
                    <select
                      name="kind"
                      className="border-border-strong bg-surface h-10 w-full rounded-lg border px-3 text-sm"
                    >
                      {Object.entries(RUN_KINDS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton>Run</SubmitButton>
                </form>
                <dl className="text-muted mt-4 space-y-2 text-xs">
                  {Object.entries(RUN_KINDS).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-ink-soft font-medium">{v.label}</dt>
                      <dd>{v.description}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader
              title="AI spend this month"
              description={
                realAi
                  ? "Estimated from token usage and published model prices."
                  : "Rules mode costs nothing."
              }
            />
            <CardBody className="space-y-2">
              <p className="text-2xl font-semibold tabular-nums">{formatMicroUsd(spent)}</p>
              <Progress
                value={budget ? Math.min(100, (spent / budget) * 100) : 0}
                label="Share of monthly AI budget"
              />
              <p className="text-muted text-xs">
                Budget {formatMicroUsd(budget)} a month,{" "}
                {formatMicroUsd(aiSettings.perClientMonthlyBudgetUsd * 1_000_000)} per client. When
                reached, agents fall back to rules mode. Change in Settings → AI.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
