import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  activityLog,
  agentRuns,
  approvals,
  audits,
  clientAssignments,
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  competitors,
  contacts,
  contentItems,
  invoices,
  meetings,
  memberships,
  messages,
  notes,
  OPEN_TASK_STATUSES,
  opportunities,
  organisations,
  reports,
  runs,
  services,
  subscriptions,
  tasks,
  timelineEntries,
  users,
} from "@/db/schema";

export async function listClients(
  db: DbOrTx,
  scope: "all" | string[],
  filters: { health?: string; q?: string } = {},
) {
  const rows = await db
    .select({ client: clients, org: organisations, manager: users.name })
    .from(clients)
    .innerJoin(organisations, eq(organisations.id, clients.organisationId))
    .leftJoin(users, eq(users.id, clients.accountManagerId))
    .orderBy(desc(clients.isInternal), asc(clients.name));
  const openTasks = await db
    .select({ org: tasks.organisationId, n: count() })
    .from(tasks)
    .where(inArray(tasks.status, OPEN_TASK_STATUSES))
    .groupBy(tasks.organisationId);
  const pending = await db
    .select({ org: approvals.organisationId, n: count() })
    .from(approvals)
    .where(eq(approvals.status, "pending"))
    .groupBy(approvals.organisationId);
  const svc = await db
    .select({
      org: clientServices.organisationId,
      names: sql<string[]>`array_agg(${services.name} order by ${services.sortOrder})`,
    })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(inArray(clientServices.status, ["active", "paused", "pending"]))
    .groupBy(clientServices.organisationId);
  return rows
    .filter((r) => !r.org.archivedAt)
    .filter((r) => scope === "all" || scope.includes(r.client.organisationId))
    .filter((r) => !filters.health || r.client.health === filters.health)
    .filter(
      (r) =>
        !filters.q ||
        r.client.name.toLowerCase().includes(filters.q.toLowerCase()) ||
        (r.client.industry ?? "").toLowerCase().includes(filters.q.toLowerCase()),
    )
    .map((r) => ({
      ...r.client,
      isDemo: r.org.isDemo,
      managerName: r.manager,
      openTasks: openTasks.find((t) => t.org === r.client.organisationId)?.n ?? 0,
      pendingApprovals: pending.find((p) => p.org === r.client.organisationId)?.n ?? 0,
      services: svc.find((s) => s.org === r.client.organisationId)?.names ?? [],
    }));
}

/** Everything the internal client view needs. Each tab reads what it needs from this. */
export async function clientDetail(db: DbOrTx, organisationId: string) {
  const [row] = await db
    .select({ client: clients, org: organisations })
    .from(clients)
    .innerJoin(organisations, eq(organisations.id, clients.organisationId))
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!row) return null;
  const now = new Date();
  const [
    serviceRows,
    contactRows,
    facts,
    goals,
    rivals,
    taskRows,
    approvalRows,
    meetingRows,
    reportRows,
    invoiceRows,
    subscriptionRows,
    auditRows,
    timeline,
    activity,
    contentRows,
    opps,
    runRows,
    portalUsers,
    assignments,
    noteRows,
    messageRows,
    aiSpend,
  ] = await Promise.all([
    db
      .select({ cs: clientServices, service: services })
      .from(clientServices)
      .innerJoin(services, eq(services.id, clientServices.serviceId))
      .where(eq(clientServices.organisationId, organisationId))
      .orderBy(asc(services.sortOrder)),
    db
      .select()
      .from(contacts)
      .where(eq(contacts.organisationId, organisationId))
      .orderBy(desc(contacts.isPrimary)),
    db
      .select()
      .from(clientBrainFacts)
      .where(eq(clientBrainFacts.organisationId, organisationId))
      .orderBy(asc(clientBrainFacts.category), desc(clientBrainFacts.createdAt)),
    db
      .select()
      .from(clientGoals)
      .where(eq(clientGoals.organisationId, organisationId))
      .orderBy(asc(clientGoals.createdAt)),
    db.select().from(competitors).where(eq(competitors.organisationId, organisationId)),
    db
      .select({ task: tasks, assignee: users.name })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(eq(tasks.organisationId, organisationId))
      .orderBy(asc(tasks.dueAt)),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.organisationId, organisationId))
      .orderBy(desc(approvals.createdAt)),
    db
      .select()
      .from(meetings)
      .where(eq(meetings.organisationId, organisationId))
      .orderBy(desc(meetings.startsAt)),
    db
      .select()
      .from(reports)
      .where(eq(reports.organisationId, organisationId))
      .orderBy(desc(reports.createdAt)),
    db
      .select()
      .from(invoices)
      .where(eq(invoices.organisationId, organisationId))
      .orderBy(desc(invoices.issuedAt)),
    db.select().from(subscriptions).where(eq(subscriptions.organisationId, organisationId)),
    db
      .select()
      .from(audits)
      .where(eq(audits.organisationId, organisationId))
      .orderBy(desc(audits.createdAt))
      .limit(10),
    db
      .select()
      .from(timelineEntries)
      .where(eq(timelineEntries.organisationId, organisationId))
      .orderBy(desc(timelineEntries.occurredAt)),
    db
      .select()
      .from(activityLog)
      .where(eq(activityLog.organisationId, organisationId))
      .orderBy(desc(activityLog.createdAt))
      .limit(50),
    db
      .select()
      .from(contentItems)
      .where(eq(contentItems.organisationId, organisationId))
      .orderBy(desc(contentItems.updatedAt)),
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.organisationId, organisationId))
      .orderBy(desc(opportunities.updatedAt)),
    db
      .select()
      .from(runs)
      .where(eq(runs.organisationId, organisationId))
      .orderBy(desc(runs.createdAt))
      .limit(10),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        lastLoginAt: users.lastLoginAt,
        hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organisationId, organisationId)),
    db
      .select({
        id: clientAssignments.id,
        responsibility: clientAssignments.responsibility,
        userId: users.id,
        name: users.name,
      })
      .from(clientAssignments)
      .innerJoin(users, eq(users.id, clientAssignments.userId))
      .where(eq(clientAssignments.organisationId, organisationId)),
    db
      .select({ note: notes, author: users.name })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.authorId))
      .where(and(eq(notes.organisationId, organisationId), eq(notes.entityType, "client")))
      .orderBy(desc(notes.createdAt)),
    db
      .select({ message: messages, author: users.name })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(eq(messages.organisationId, organisationId))
      .orderBy(asc(messages.createdAt)),
    db
      .select({ total: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}), 0)::bigint` })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.organisationId, organisationId),
          gte(agentRuns.createdAt, new Date(now.getFullYear(), now.getMonth(), 1)),
        ),
      ),
  ]);
  const [manager] = row.client.accountManagerId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.client.accountManagerId))
    : [];
  return {
    client: row.client,
    org: row.org,
    managerName: manager?.name ?? null,
    services: serviceRows,
    contacts: contactRows,
    facts,
    goals,
    competitors: rivals,
    tasks: taskRows,
    approvals: approvalRows,
    meetings: meetingRows,
    nextMeeting:
      meetingRows
        .filter((m) => m.startsAt > now && m.status === "scheduled")
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null,
    reports: reportRows,
    invoices: invoiceRows,
    subscriptions: subscriptionRows,
    audits: auditRows,
    latestAudit: auditRows.find((a) => a.status === "complete") ?? null,
    timeline,
    activity,
    content: contentRows,
    opportunities: opps,
    runs: runRows,
    portalUsers,
    assignments,
    notes: noteRows,
    messages: messageRows,
    aiSpendMicroUsd: Number(aiSpend[0]?.total ?? 0),
  };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof clientDetail>>>;
