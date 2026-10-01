import { and, count, eq, gte, inArray, lt, max, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  approvals,
  audits,
  clients,
  clientServices,
  type HealthReason,
  type HealthState,
  messages,
  OPEN_TASK_STATUSES,
  tasks,
} from "@/db/schema";

export interface HealthSignals {
  billingState: string;
  lifecycle: string;
  automationPaused: boolean;
  activeServices: number;
  pausedServices: number;
  overdueTasks: number;
  completedTasksLast30: number;
  clientApprovalsWaitingOver5Days: number;
  criticalFindings: number | null;
  lastClientMessageDays: number | null;
}

/**
 * Explains client health from observable signals. No weighted score: the state is the
 * worst applicable condition, and every reason is listed so it can be acted on.
 */
export function assessHealth(s: HealthSignals): { state: HealthState; reasons: HealthReason[] } {
  const reasons: HealthReason[] = [];
  let state: HealthState = "healthy";
  const worsen = (to: HealthState) => {
    const rank: Record<HealthState, number> = { healthy: 0, watch: 1, at_risk: 2, paused: 3 };
    if (rank[to] > rank[state]) state = to;
  };

  if (
    s.lifecycle === "paused" ||
    s.lifecycle === "offboarded" ||
    s.billingState === "suspended" ||
    s.billingState === "cancelled"
  ) {
    reasons.push({
      signal: "Account status",
      detail: `Account is ${s.billingState === "suspended" ? "suspended" : s.lifecycle}.`,
      effect: "negative",
    });
    worsen("paused");
  }
  if (s.billingState === "overdue") {
    reasons.push({
      signal: "Payment",
      detail: "An invoice is overdue; automated work is paused until payment.",
      effect: "negative",
    });
    worsen("at_risk");
  } else if (s.billingState === "payment_due") {
    reasons.push({ signal: "Payment", detail: "An invoice is due soon.", effect: "neutral" });
    worsen("watch");
  } else if (s.billingState === "active") {
    reasons.push({ signal: "Payment", detail: "Billing is up to date.", effect: "positive" });
  }
  if (s.clientApprovalsWaitingOver5Days > 0) {
    reasons.push({
      signal: "Approvals",
      detail: `${s.clientApprovalsWaitingOver5Days} item(s) have waited more than 5 days for client approval.`,
      effect: "negative",
    });
    worsen("watch");
  }
  if (s.overdueTasks >= 3) {
    reasons.push({
      signal: "Delivery",
      detail: `${s.overdueTasks} tasks are overdue.`,
      effect: "negative",
    });
    worsen("watch");
  } else if (s.overdueTasks > 0) {
    reasons.push({
      signal: "Delivery",
      detail: `${s.overdueTasks} task(s) overdue.`,
      effect: "neutral",
    });
  }
  if (s.completedTasksLast30 === 0 && s.lifecycle === "active") {
    reasons.push({
      signal: "Activity",
      detail: "No work completed in the last 30 days.",
      effect: "negative",
    });
    worsen("watch");
  } else if (s.completedTasksLast30 > 0) {
    reasons.push({
      signal: "Activity",
      detail: `${s.completedTasksLast30} task(s) completed in the last 30 days.`,
      effect: "positive",
    });
  }
  if (s.pausedServices > 0 && s.billingState !== "overdue") {
    reasons.push({
      signal: "Services",
      detail: `${s.pausedServices} service(s) paused.`,
      effect: "neutral",
    });
    worsen("watch");
  }
  if (s.activeServices === 0 && s.lifecycle === "active") {
    reasons.push({ signal: "Services", detail: "No active services.", effect: "negative" });
    worsen("watch");
  }
  if (s.criticalFindings !== null && s.criticalFindings > 0) {
    reasons.push({
      signal: "Visibility",
      detail: `Latest audit has ${s.criticalFindings} critical finding(s).`,
      effect: "negative",
    });
  }
  if (s.lastClientMessageDays !== null && s.lastClientMessageDays > 45) {
    reasons.push({
      signal: "Engagement",
      detail: "No message from the client in over 45 days.",
      effect: "neutral",
    });
    worsen("watch");
  }
  if (s.automationPaused)
    reasons.push({
      signal: "Automation",
      detail: "Automation is paused for this client.",
      effect: "neutral",
    });
  return { state, reasons };
}

export async function gatherHealthSignals(
  db: DbOrTx,
  organisationId: string,
): Promise<HealthSignals | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!client) return null;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400_000);
  const [[svc], [overdue], [done], [waiting], [lastAudit], [lastMsg]] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where ${clientServices.status} = 'active')::int`,
        paused: sql<number>`count(*) filter (where ${clientServices.status} = 'paused')::int`,
      })
      .from(clientServices)
      .where(eq(clientServices.organisationId, organisationId)),
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, organisationId),
          inArray(tasks.status, OPEN_TASK_STATUSES),
          lt(tasks.dueAt, now),
        ),
      ),
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, organisationId),
          eq(tasks.status, "complete"),
          gte(tasks.completedAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({ n: count() })
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, organisationId),
          eq(approvals.status, "pending"),
          eq(approvals.level, "client"),
          lt(approvals.createdAt, fiveDaysAgo),
        ),
      ),
    db
      .select({ result: audits.result })
      .from(audits)
      .where(and(eq(audits.organisationId, organisationId), eq(audits.status, "complete")))
      .orderBy(sql`${audits.completedAt} desc`)
      .limit(1),
    db
      .select({ at: max(messages.createdAt) })
      .from(messages)
      .where(and(eq(messages.organisationId, organisationId), eq(messages.fromClient, true))),
  ]);
  return {
    billingState: client.billingState,
    lifecycle: client.lifecycle,
    automationPaused: client.automationPaused,
    activeServices: svc?.active ?? 0,
    pausedServices: svc?.paused ?? 0,
    overdueTasks: overdue?.n ?? 0,
    completedTasksLast30: done?.n ?? 0,
    clientApprovalsWaitingOver5Days: waiting?.n ?? 0,
    criticalFindings: lastAudit?.result ? lastAudit.result.counts.critical : null,
    lastClientMessageDays: lastMsg?.at
      ? Math.floor((now.getTime() - new Date(lastMsg.at).getTime()) / 86400_000)
      : null,
  };
}

export async function recomputeHealth(
  db: DbOrTx,
  organisationId: string,
): Promise<{ state: HealthState; reasons: HealthReason[] } | null> {
  const signals = await gatherHealthSignals(db, organisationId);
  if (!signals) return null;
  const result = assessHealth(signals);
  await db
    .update(clients)
    .set({ health: result.state, healthReasons: result.reasons, healthCheckedAt: new Date() })
    .where(eq(clients.organisationId, organisationId));
  return result;
}
