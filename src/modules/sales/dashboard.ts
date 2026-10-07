import { and, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { clients, clientServices, leads, meetings, proposals } from "@/db/schema";
import { leadChannel } from "@/modules/leads/attribution";

/**
 * Sales dashboard numbers, all from records in this system:
 * - Funnel: leads created in the window and how far each got, using evidence (a meeting,
 *   a sent proposal, an acceptance) rather than the current stage alone.
 * - New and lost MRR this month from client services started or cancelled.
 * - Win rate from decided proposals; channels from first-touch attribution.
 */
export async function salesDashboard(db: DbOrTx, now = new Date(), windowDays = 90) {
  const since = new Date(now.getTime() - windowDays * 86400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const cohort = await db
    .select({
      id: leads.id,
      stage: leads.stage,
      source: leads.source,
      attribution: leads.attribution,
      clientOrganisationId: leads.clientOrganisationId,
    })
    .from(leads)
    .where(gte(leads.createdAt, since));
  const ids = cohort.map((l) => l.id);
  const [met, proposed] = ids.length
    ? await Promise.all([
        db
          .selectDistinct({ leadId: meetings.leadId })
          .from(meetings)
          .where(inArray(meetings.leadId, ids)),
        db
          .select({ leadId: proposals.leadId, status: proposals.status })
          .from(proposals)
          .where(and(inArray(proposals.leadId, ids), ne(proposals.status, "draft"))),
      ])
    : [[], []];
  const metSet = new Set(met.map((m) => m.leadId));
  const sentSet = new Set(proposed.map((p) => p.leadId));
  const wonSet = new Set<string>();
  for (const p of proposed) if (p.status === "accepted" && p.leadId) wonSet.add(p.leadId);
  for (const l of cohort) if (l.clientOrganisationId) wonSet.add(l.id);
  const early = new Set(["new", "audit_generated", "lost", "nurture", "archived"]);
  const funnel = [
    { label: "New leads", value: cohort.length },
    {
      label: "Qualified or engaged",
      value: cohort.filter((l) => !early.has(l.stage) || metSet.has(l.id) || sentSet.has(l.id))
        .length,
    },
    { label: "Call booked", value: cohort.filter((l) => metSet.has(l.id)).length },
    { label: "Proposal sent", value: cohort.filter((l) => sentSet.has(l.id)).length },
    { label: "Won", value: cohort.filter((l) => wonSet.has(l.id)).length },
  ];

  const channels = new Map<string, { leads: number; won: number }>();
  for (const l of cohort) {
    const c = leadChannel(l);
    const row = channels.get(c) ?? { leads: 0, won: 0 };
    row.leads++;
    if (wonSet.has(l.id)) row.won++;
    channels.set(c, row);
  }

  const external = and(eq(clientServices.currency, "ZAR"), eq(clients.isInternal, false));
  const [started, cancelled, decided] = await Promise.all([
    db
      .select({ monthlyMinor: clientServices.monthlyMinor })
      .from(clientServices)
      .innerJoin(clients, eq(clients.organisationId, clientServices.organisationId))
      .where(and(external, gte(clientServices.startedAt, monthStart))),
    db
      .select({ monthlyMinor: clientServices.monthlyMinor })
      .from(clientServices)
      .innerJoin(clients, eq(clients.organisationId, clientServices.organisationId))
      .where(
        and(
          external,
          isNotNull(clientServices.cancelledAt),
          gte(clientServices.cancelledAt, monthStart),
        ),
      ),
    db
      .select({ status: proposals.status })
      .from(proposals)
      .where(
        and(
          inArray(proposals.status, ["accepted", "declined", "expired"]),
          gte(proposals.updatedAt, since),
        ),
      ),
  ]);
  const newMrr = started.reduce((s, r) => s + r.monthlyMinor, 0);
  const lostMrr = cancelled.reduce((s, r) => s + r.monthlyMinor, 0);
  const accepted = decided.filter((d) => d.status === "accepted").length;

  return {
    windowDays,
    funnel,
    channels: [...channels.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.leads - a.leads),
    newMrr,
    lostMrr,
    netMrr: newMrr - lostMrr,
    winRate: decided.length ? accepted / decided.length : null,
    decidedProposals: decided.length,
  };
}
