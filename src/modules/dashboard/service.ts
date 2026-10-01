import { and, count, desc, eq, gte, inArray, lt, lte, notInArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DbOrTx } from "@/db";
import {
  agentRuns,
  approvals,
  clients,
  clientServices,
  contentItems,
  invoices,
  jobs,
  leads,
  meetings,
  OPEN_TASK_STATUSES,
  opportunities,
  payments,
  reports,
  runs,
  services,
  tasks,
} from "@/db/schema";
import { startOfDayTz } from "@/lib/format";

const CLOSED_STAGES = ["active_client", "lost", "archived", "nurture"] as const;

/** Everything the founder needs to answer "what matters today?". */
export async function commandCentre(
  db: DbOrTx,
  scope: "all" | string[],
  userId: string,
  platformOrgId: string,
) {
  const now = new Date();
  const today = startOfDayTz(now);
  const tomorrowEnd = new Date(today.getTime() + 2 * 86400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const orgFilter = (column: AnyPgColumn) =>
    scope === "all" ? undefined : inArray(column, [...scope, platformOrgId]);

  const [
    meetingsSoon,
    pendingApprovals,
    overdueTasks,
    dueToday,
    newLeads,
    reportsInReview,
    contentAwaiting,
    overdueInvoices,
    failedPayments,
    failedRuns,
    failedJobs,
    blockedAgents,
    openOpps,
    clientRows,
    serviceRevenue,
    pipeline,
    outstanding,
    wonLost,
  ] = await Promise.all([
    db
      .select()
      .from(meetings)
      .where(
        and(
          gte(meetings.startsAt, today),
          lte(meetings.startsAt, tomorrowEnd),
          inArray(meetings.status, ["scheduled", "requested"]),
        ),
      )
      .orderBy(meetings.startsAt),
    db
      .select({
        id: approvals.id,
        title: approvals.title,
        level: approvals.level,
        organisationId: approvals.organisationId,
        createdAt: approvals.createdAt,
        type: approvals.type,
      })
      .from(approvals)
      .where(and(eq(approvals.status, "pending"), orgFilter(approvals.organisationId)))
      .orderBy(approvals.createdAt),
    db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, OPEN_TASK_STATUSES),
          lt(tasks.dueAt, today),
          orgFilter(tasks.organisationId),
        ),
      )
      .orderBy(tasks.dueAt)
      .limit(20),
    db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, OPEN_TASK_STATUSES),
          gte(tasks.dueAt, today),
          lt(tasks.dueAt, new Date(today.getTime() + 86400_000)),
          orgFilter(tasks.organisationId),
        ),
      ),
    db.select().from(leads).where(gte(leads.createdAt, weekAgo)).orderBy(desc(leads.createdAt)),
    db
      .select({ id: reports.id, title: reports.title, organisationId: reports.organisationId })
      .from(reports)
      .where(eq(reports.status, "in_review")),
    db
      .select({ n: count() })
      .from(contentItems)
      .where(inArray(contentItems.stage, ["internal_review", "client_approval"])),
    db.select().from(invoices).where(eq(invoices.status, "overdue")),
    db
      .select({ n: count() })
      .from(payments)
      .where(and(eq(payments.status, "failed"), gte(payments.receivedAt, weekAgo))),
    db
      .select({
        id: runs.id,
        kind: runs.kind,
        organisationId: runs.organisationId,
        error: runs.error,
      })
      .from(runs)
      .where(and(eq(runs.status, "failed"), gte(runs.createdAt, weekAgo))),
    db.select({ n: count() }).from(jobs).where(eq(jobs.status, "failed")),
    db
      .select({ n: count() })
      .from(agentRuns)
      .where(and(eq(agentRuns.status, "blocked"), gte(agentRuns.createdAt, weekAgo))),
    db.select({ n: count() }).from(opportunities).where(eq(opportunities.status, "open")),
    db.select().from(clients),
    db
      .select({
        name: services.name,
        total: sql<number>`sum(${clientServices.monthlyMinor})::bigint`,
      })
      .from(clientServices)
      .innerJoin(services, eq(services.id, clientServices.serviceId))
      .where(inArray(clientServices.status, ["active", "paused"]))
      .groupBy(services.name)
      .orderBy(desc(sql`sum(${clientServices.monthlyMinor})`)),
    db
      .select({
        stage: leads.stage,
        n: count(),
        value: sql<number>`coalesce(sum(${leads.estimatedMonthlyMinor}), 0)::bigint`,
      })
      .from(leads)
      .where(notInArray(leads.stage, [...CLOSED_STAGES]))
      .groupBy(leads.stage),
    db
      .select({
        total: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::bigint`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ["open", "overdue"])),
    db
      .select({
        won: sql<number>`count(*) filter (where ${leads.stage} in ('active_client','onboarding','payment_pending','accepted'))::int`,
        lost: sql<number>`count(*) filter (where ${leads.stage} = 'lost')::int`,
      })
      .from(leads)
      .where(gte(leads.createdAt, new Date(now.getTime() - 180 * 86400_000))),
  ]);

  const paying = clientRows.filter(
    (c) =>
      !c.isInternal &&
      c.lifecycle !== "offboarded" &&
      c.billingState !== "cancelled" &&
      c.billingState !== "pending_payment",
  );
  const mrrMinor = paying.reduce((s, c) => s + c.monthlyValueMinor, 0);
  const renewals = clientRows.filter(
    (c) =>
      c.renewalDate &&
      new Date(c.renewalDate).getTime() - now.getTime() < 30 * 86400_000 &&
      new Date(c.renewalDate) > now,
  );
  const health = { healthy: 0, watch: 0, at_risk: 0, paused: 0 } as Record<string, number>;
  for (const c of clientRows.filter((c) => !c.isInternal))
    health[c.health] = (health[c.health] ?? 0) + 1;
  const newClients = clientRows.filter(
    (c) => !c.isInternal && c.createdAt > new Date(now.getTime() - 30 * 86400_000),
  );
  const pipelineValue = pipeline.reduce((s, p) => s + Number(p.value), 0);
  const conversion =
    wonLost[0] && wonLost[0].won + wonLost[0].lost > 0
      ? Math.round((wonLost[0].won / (wonLost[0].won + wonLost[0].lost)) * 100)
      : null;

  const clientName = (orgId: string) =>
    clientRows.find((c) => c.organisationId === orgId)?.name ?? "Mea Creo";

  // Daily brief: actionable priorities, in order of consequence.
  const priorities: { text: string; href: string }[] = [];
  if (overdueInvoices.length)
    priorities.push({
      text: `Follow up ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""} (${overdueInvoices.map((i) => clientName(i.organisationId)).join(", ")})`,
      href: "/workspace/billing",
    });
  const internalApprovals = pendingApprovals.filter((a) => a.level !== "client");
  if (internalApprovals.length)
    priorities.push({
      text: `Decide ${internalApprovals.length} approval${internalApprovals.length > 1 ? "s" : ""} waiting on Mea Creo`,
      href: "/workspace/approvals",
    });
  const nextMeeting = meetingsSoon.find((m) => m.type !== "internal") ?? meetingsSoon[0];
  if (nextMeeting)
    priorities.push({
      text: `Prepare for "${nextMeeting.title}" (briefing ready)`,
      href: `/workspace/meetings/${nextMeeting.id}`,
    });
  if (overdueTasks.length)
    priorities.push({
      text: `Clear ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`,
      href: "/workspace/tasks?view=overdue",
    });
  const freshLeads = newLeads.filter((l) => l.stage === "new" || l.stage === "audit_generated");
  if (freshLeads.length)
    priorities.push({
      text: `Respond to ${freshLeads.length} new lead${freshLeads.length > 1 ? "s" : ""}`,
      href: "/workspace/leads",
    });
  const atRisk = clientRows.filter((c) => c.health === "at_risk");
  if (atRisk.length)
    priorities.push({
      text: `Check in with at-risk client${atRisk.length > 1 ? "s" : ""}: ${atRisk.map((c) => c.name).join(", ")}`,
      href: `/workspace/clients/${atRisk[0].organisationId}`,
    });

  return {
    meetingsSoon,
    pendingApprovals,
    clientApprovalsWaiting: pendingApprovals.filter((a) => a.level === "client"),
    internalApprovals,
    overdueTasks,
    dueToday,
    newLeads,
    newClients,
    reportsInReview,
    contentAwaiting: contentAwaiting[0]?.n ?? 0,
    overdueInvoices,
    failedPayments: failedPayments[0]?.n ?? 0,
    alerts: {
      failedRuns,
      failedJobs: failedJobs[0]?.n ?? 0,
      blockedAgents: blockedAgents[0]?.n ?? 0,
    },
    openOpportunities: openOpps[0]?.n ?? 0,
    kpis: {
      mrrMinor,
      activeClients: paying.length,
      openLeads: pipeline.reduce((s, p) => s + p.n, 0),
      pipelineValueMinor: pipelineValue,
      conversion,
      servicesSold: serviceRevenue.length,
      outstandingMinor: Number(outstanding[0]?.total ?? 0),
      renewals,
    },
    health,
    serviceRevenue: serviceRevenue.map((s) => ({ name: s.name, total: Number(s.total) })),
    pipeline: pipeline.map((p) => ({ stage: p.stage, n: p.n, value: Number(p.value) })),
    priorities,
    clientName,
    userId,
  };
}
