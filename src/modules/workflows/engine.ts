import { asc, eq, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import { clients, domainEvents, leads, memberships, organisations, tasks } from "@/db/schema";
import { logger } from "@/lib/logger";
import { logActivity, SYSTEM } from "@/modules/activity/log";
import { recomputeHealth } from "@/modules/clients/health";
import { getPlatformOrganisation, getPlatformSetting } from "@/modules/settings/service";

export type Maturity = "manual" | "assisted" | "automated";

export interface WorkflowRule {
  id: string;
  name: string;
  when: string;
  description: string;
  then: string[];
  /** Default maturity: automated runs actions; assisted creates a task; manual only logs. */
  defaultMaturity: Maturity;
  handler: (db: DbOrTx, event: typeof domainEvents.$inferSelect) => Promise<void>;
}

/**
 * Built-in workflow rules (WHEN event THEN actions). Billing, approvals, onboarding and
 * payments already act in their own modules; these rules add the follow-on automation.
 */
export const WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: "lead-assign-owner",
    name: "Assign new leads",
    when: "lead.created",
    description:
      "New leads without an owner are assigned to the founder so nothing falls through the cracks.",
    then: ["Assign owner", "Create a follow-up task"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      const leadId = String(event.payload.leadId ?? "");
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead || lead.ownerId) return;
      const platform = await getPlatformOrganisation(db);
      const [founder] = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(eq(memberships.organisationId, platform.id))
        .limit(1);
      if (!founder) return;
      await db.update(leads).set({ ownerId: founder.userId }).where(eq(leads.id, leadId));
      await db.insert(tasks).values({
        organisationId: platform.id,
        title: `Follow up with ${lead.company}`,
        assigneeId: founder.userId,
        dueAt: new Date(Date.now() + 2 * 86400_000),
        source: "workflow",
        sourceRef: `lead:${leadId}`,
      });
    },
  },
  {
    id: "invoice-overdue-task",
    name: "Overdue invoice follow-up",
    when: "invoice.overdue",
    description:
      "When an invoice becomes overdue, the client is notified (billing), the account manager gets a follow-up task, and health is recalculated.",
    then: [
      "Notify client",
      "Notify admin",
      "Create follow-up task",
      "Recalculate client health",
      "Pause configured services after the grace period",
    ],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (!event.organisationId) return;
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.organisationId, event.organisationId))
        .limit(1);
      await db.insert(tasks).values({
        organisationId: event.organisationId,
        title: "Follow up on overdue invoice",
        priority: "urgent",
        assigneeId: client?.accountManagerId ?? null,
        dueAt: new Date(Date.now() + 86400_000),
        source: "workflow",
        sourceRef: `event:${event.id}`,
      });
      await recomputeHealth(db, event.organisationId);
    },
  },
  {
    id: "payment-health",
    name: "Payment received",
    when: "payment.completed",
    description:
      "Recalculates client health after a payment. Service restoration happens in billing.",
    then: ["Restore paused services", "Recalculate client health"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (event.organisationId) await recomputeHealth(db, event.organisationId);
    },
  },
  {
    id: "approval-completed-health",
    name: "Approval decided",
    when: "approval.completed",
    description: "Keeps client health current when approvals are decided.",
    then: ["Recalculate client health"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (event.organisationId) {
        const [org] = await db
          .select({ kind: organisations.kind })
          .from(organisations)
          .where(eq(organisations.id, event.organisationId));
        if (org?.kind === "client") await recomputeHealth(db, event.organisationId);
      }
    },
  },
  {
    id: "run-growth-monthly",
    name: "Monthly client cycle",
    when: "monthly_cycle.started",
    description:
      "On the configured day, a monthly review run is created for every active client, producing draft reports for approval.",
    then: [
      "Run Monthly Client Review per active client",
      "Request internal approval for each report",
    ],
    defaultMaturity: "assisted",
    handler: async (db) => {
      const { createRun } = await import("@/modules/runs/engine");
      const active = await db
        .select({ organisationId: clients.organisationId })
        .from(clients)
        .where(eq(clients.lifecycle, "active"));
      for (const c of active)
        await createRun(db, {
          organisationId: c.organisationId,
          kind: "monthly_client_review",
          trigger: "schedule",
        });
    },
  },
];

export async function workflowMaturity(db: DbOrTx, ruleId: string): Promise<Maturity> {
  const automation = await getPlatformSetting(db, "automation");
  const override = automation.approvalOverrides[`workflow:${ruleId}`];
  if (override === "automatic") return "automated";
  if (override === "internal" || override === "client") return "assisted";
  if (override === "manual") return "manual";
  return WORKFLOW_RULES.find((r) => r.id === ruleId)?.defaultMaturity ?? "manual";
}

/** Delivers unprocessed events to matching rules. At-least-once; handlers are idempotent. */
export async function processDomainEvents(db: Db, limit = 100): Promise<number> {
  const emergency = await getPlatformSetting(db, "emergency");
  const pending = await db
    .select()
    .from(domainEvents)
    .where(isNull(domainEvents.processedAt))
    .orderBy(asc(domainEvents.createdAt))
    .limit(limit);
  for (const event of pending) {
    let error: string | null = null;
    if (!emergency.pauseAllAutomation) {
      for (const rule of WORKFLOW_RULES.filter((r) => r.when === event.type)) {
        try {
          const maturity = await workflowMaturity(db, rule.id);
          if (maturity === "automated") await rule.handler(db, event);
          else if (maturity === "assisted") {
            const platform = await getPlatformOrganisation(db);
            await db.insert(tasks).values({
              organisationId: event.organisationId ?? platform.id,
              title: `Workflow "${rule.name}": review and run`,
              description: rule.then.join(" → "),
              source: "workflow",
              sourceRef: `event:${event.id}`,
            });
          }
          await logActivity(db, SYSTEM, {
            organisationId: event.organisationId,
            action: `workflow.${rule.id}`,
            summary: `Workflow "${rule.name}" (${maturity}) handled ${event.type}`,
          });
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          logger.error({ rule: rule.id, eventId: event.id, err: error }, "workflow rule failed");
        }
      }
    }
    await db
      .update(domainEvents)
      .set({ processedAt: new Date(), error })
      .where(eq(domainEvents.id, event.id));
  }
  return pending.length;
}
