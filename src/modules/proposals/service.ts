import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import {
  audits,
  leadActivities,
  leads,
  meetings,
  proposalItems,
  proposals,
  services,
} from "@/db/schema";
import { checkQuality } from "@/agents/quality";
import { runAgent } from "@/agents/runtime";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { formatMoney, isCurrency, money } from "@/lib/money";
import { absoluteUrl } from "@/lib/urls";
import { type Actor, logActivity } from "@/modules/activity/log";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { emitEvent, notifyStaff } from "@/modules/notifications/service";
import { getPlatformSetting } from "@/modules/settings/service";

export type ProposalItem = typeof proposalItems.$inferSelect;

export function proposalTotals(
  items: Pick<ProposalItem, "setupMinor" | "monthlyMinor" | "oneOffMinor" | "optional">[],
  discountPercent = 0,
) {
  const core = items.filter((i) => !i.optional);
  const monthlyBefore = core.reduce((s, i) => s + i.monthlyMinor, 0);
  const discount = Math.round((monthlyBefore * discountPercent) / 100);
  return {
    setupMinor: core.reduce((s, i) => s + i.setupMinor + i.oneOffMinor, 0),
    monthlyMinor: monthlyBefore - discount,
    monthlyDiscountMinor: discount,
    optionalMonthlyMinor: items.filter((i) => i.optional).reduce((s, i) => s + i.monthlyMinor, 0),
  };
}

async function nextProposalNumber(db: DbOrTx): Promise<string> {
  const billing = await getPlatformSetting(db, "billing");
  const prefix = `${billing.proposalPrefix}-${new Date().getFullYear()}-`;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proposals)
    .where(like(proposals.number, `${prefix}%`));
  let seq = (row?.n ?? 0) + 1;
  for (;;) {
    const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
    const [exists] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.number, candidate))
      .limit(1);
    if (!exists) return candidate;
    seq++;
  }
}

/**
 * Drafts a proposal from what we actually know: the lead's snapshot, call outcome and
 * recommended services. Prices come only from the service catalogue; services without
 * a configured price are added at zero and flagged for the owner to price.
 */
export async function createProposalFromLead(
  db: Db,
  leadId: string,
  actor: { id: string; name: string },
): Promise<string> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new AppError("NOT_FOUND");
  const [audit] = await db
    .select({ result: audits.result })
    .from(audits)
    .where(and(eq(audits.leadId, leadId), eq(audits.status, "complete")))
    .orderBy(desc(audits.completedAt))
    .limit(1);
  const [meeting] = await db
    .select({ outcome: meetings.outcome })
    .from(meetings)
    .where(eq(meetings.leadId, leadId))
    .orderBy(desc(meetings.startsAt))
    .limit(1);
  const billing = await getPlatformSetting(db, "billing");
  const currency = billing.defaultCurrency;

  const slugs = lead.recommendedServices.length ? lead.recommendedServices : ["seo"];
  const catalogue = await db.select().from(services).where(eq(services.status, "active"));
  const chosen = slugs
    .map((slug) => catalogue.find((s) => s.slug === slug))
    .filter((s): s is (typeof catalogue)[number] => Boolean(s));

  const problems = [
    ...(meeting?.outcome?.needs ?? []),
    ...(audit?.result?.opportunities.slice(0, 3).map((o) => o.description.split(". ")[0] + ".") ??
      []),
  ].slice(0, 5);
  const goals = meeting?.outcome?.goals?.length
    ? meeting.outcome.goals
    : lead.goal
      ? [lead.goal]
      : ["More qualified enquiries from people searching for your services"];

  const summary = await runAgent(db, {
    agent: "proposal",
    action: "write.proposal_drafts",
    organisationId: null,
    input: { leadId, services: slugs },
    prompt: {
      system:
        "Write a 2-3 sentence proposal summary for a B2B client. Plain, specific, confident. Mention only the services listed. No guarantees, no buzzwords, no prices.",
      user: JSON.stringify({
        company: lead.company,
        problems,
        goals,
        services: chosen.map((s) => s.name),
      }),
      maxTokens: 400,
    },
    rules: () =>
      `A ${chosen.length > 1 ? "combined" : "focused"} programme to help ${lead.company} become easier to find, trust and choose: ${chosen.map((s) => s.name).join(", ")}, delivered and reported monthly.`,
  });

  const [proposal] = await db
    .insert(proposals)
    .values({
      leadId,
      number: await nextProposalNumber(db),
      title: `${chosen
        .map((s) => s.name)
        .slice(0, 2)
        .join(" & ")} for ${lead.company}`,
      companyName: lead.company,
      contactName: lead.contactName,
      contactEmail: lead.email,
      publicToken: randomToken(18),
      currency,
      summary: summary.text,
      problems,
      goals,
      activities: chosen.flatMap((s) => s.includedActivities.slice(0, 3)),
      kpis: [...new Set(chosen.flatMap((s) => s.kpis))].slice(0, 6),
      timeline:
        "Month 1: onboarding and foundations. Months 2–3: implementation and first results. Ongoing: measure, report and improve monthly.",
      assumptions: "Access to the website, relevant accounts and a named contact for approvals.",
      terms:
        "Minimum term as stated, then month to month with 30 days' notice. Setup fees are due on acceptance; monthly fees are billed in advance. (Standard terms: have these reviewed by an attorney before use.)",
      validUntil: new Date(Date.now() + 21 * 86400_000),
      createdById: actor.id,
    })
    .returning({ id: proposals.id });

  let order = 0;
  for (const s of chosen) {
    const price = s.prices[currency] ?? {};
    await db.insert(proposalItems).values({
      proposalId: proposal.id,
      serviceId: s.id,
      name: s.name,
      description: s.summary,
      setupMinor: price.setupMinor ?? 0,
      monthlyMinor: s.billingType === "monthly" ? (price.monthlyMinor ?? 0) : 0,
      oneOffMinor: s.billingType === "once_off" ? (price.oneOffMinor ?? 0) : 0,
      sortOrder: order++,
    });
  }
  await db
    .update(leads)
    .set({ stage: "proposal_draft", lastActivityAt: new Date() })
    .where(eq(leads.id, leadId));
  await db
    .insert(leadActivities)
    .values({ leadId, type: "proposal", summary: "Proposal drafted.", actorId: actor.id });
  await emitEvent(db, "proposal.created", null, { proposalId: proposal.id, leadId });
  return proposal.id;
}

export async function getProposal(db: DbOrTx, id: string) {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!proposal) return null;
  const items = await db
    .select()
    .from(proposalItems)
    .where(eq(proposalItems.proposalId, id))
    .orderBy(asc(proposalItems.sortOrder));
  return { proposal, items };
}

export async function getProposalByToken(db: DbOrTx, token: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.publicToken, token))
    .limit(1);
  return proposal ? getProposal(db, proposal.id) : null;
}

/** Issues that must be resolved before sending (unpriced services, unsupported claims). */
export async function proposalReadiness(db: DbOrTx, id: string): Promise<string[]> {
  const data = await getProposal(db, id);
  if (!data) return ["Proposal not found."];
  const issues: string[] = [];
  const unpriced = data.items.filter(
    (i) => !i.optional && i.setupMinor === 0 && i.monthlyMinor === 0 && i.oneOffMinor === 0,
  );
  if (unpriced.length) issues.push(`Set a price for: ${unpriced.map((i) => i.name).join(", ")}.`);
  if (!data.proposal.contactEmail) issues.push("Add the contact's email address.");
  const qc = checkQuality(
    [
      data.proposal.summary,
      ...data.proposal.problems,
      ...data.proposal.goals,
      ...data.proposal.activities,
      data.proposal.terms ?? "",
    ].join("\n"),
  );
  for (const issue of qc.issues.filter((i) => i.severity === "block"))
    issues.push(`${issue.rule}: ${issue.detail}`);
  return issues;
}

export const proposalEditSchema = z.object({
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(3000),
  problems: z.string().max(4000),
  goals: z.string().max(4000),
  activities: z.string().max(4000),
  kpis: z.string().max(2000),
  timeline: z.string().max(2000).optional(),
  assumptions: z.string().max(2000).optional(),
  terms: z.string().max(6000).optional(),
  contractMonths: z.coerce.number().int().min(1).max(36),
  discountPercent: z.coerce.number().int().min(0).max(50),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
});

const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

export async function updateProposal(
  db: DbOrTx,
  id: string,
  input: z.infer<typeof proposalEditSchema>,
  itemPrices: {
    id: string;
    setupMinor: number;
    monthlyMinor: number;
    oneOffMinor: number;
    optional: boolean;
  }[],
) {
  const [existing] = await db
    .select({ status: proposals.status })
    .from(proposals)
    .where(eq(proposals.id, id));
  if (!existing) throw new AppError("NOT_FOUND");
  if (existing.status === "accepted")
    throw new AppError("CONFLICT", { userMessage: "Accepted proposals can't be edited." });
  await db
    .update(proposals)
    .set({
      title: input.title,
      summary: input.summary,
      problems: lines(input.problems),
      goals: lines(input.goals),
      activities: lines(input.activities),
      kpis: lines(input.kpis),
      timeline: input.timeline,
      assumptions: input.assumptions,
      terms: input.terms,
      contractMonths: input.contractMonths,
      discountPercent: input.discountPercent,
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
    })
    .where(eq(proposals.id, id));
  for (const item of itemPrices) {
    await db
      .update(proposalItems)
      .set({
        setupMinor: item.setupMinor,
        monthlyMinor: item.monthlyMinor,
        oneOffMinor: item.oneOffMinor,
        optional: item.optional,
      })
      .where(and(eq(proposalItems.id, item.id), eq(proposalItems.proposalId, id)));
  }
}

export async function addProposalItem(
  db: DbOrTx,
  proposalId: string,
  serviceId: string,
  currency: string,
) {
  const [s] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!s) throw new AppError("NOT_FOUND");
  const price = s.prices[currency] ?? {};
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proposalItems)
    .where(eq(proposalItems.proposalId, proposalId));
  await db.insert(proposalItems).values({
    proposalId,
    serviceId,
    name: s.name,
    description: s.summary,
    setupMinor: price.setupMinor ?? 0,
    monthlyMinor: s.billingType === "monthly" ? (price.monthlyMinor ?? 0) : 0,
    oneOffMinor: s.billingType === "once_off" ? (price.oneOffMinor ?? 0) : 0,
    sortOrder: n,
  });
}

export async function removeProposalItem(db: DbOrTx, proposalId: string, itemId: string) {
  await db
    .delete(proposalItems)
    .where(and(eq(proposalItems.id, itemId), eq(proposalItems.proposalId, proposalId)));
}

/** Sends the proposal to the client. Blocked while readiness issues remain. */
export async function sendProposal(db: DbOrTx, id: string, actor: Actor): Promise<void> {
  const issues = await proposalReadiness(db, id);
  if (issues.length)
    throw new AppError("VALIDATION", {
      userMessage: `Resolve before sending: ${issues.join(" ")}`,
    });
  const data = (await getProposal(db, id))!;
  const { proposal } = data;
  await db
    .update(proposals)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(proposals.id, id));
  await sendEmail(db, {
    to: { email: proposal.contactEmail!, name: proposal.contactName ?? undefined },
    template: "proposalSent",
    category: "transactional",
    email: emailTemplates.proposalSent({
      name: proposal.contactName ?? "there",
      company: proposal.companyName,
      url: absoluteUrl(`/proposal/${proposal.publicToken}`),
    }),
    idempotencyKey: `proposal-sent:${id}:${Date.now().toString().slice(0, -5)}`,
  });
  if (proposal.leadId) {
    await db
      .update(leads)
      .set({ stage: "proposal_sent", lastActivityAt: new Date() })
      .where(eq(leads.id, proposal.leadId));
    await db.insert(leadActivities).values({
      leadId: proposal.leadId,
      type: "proposal",
      summary: `Proposal ${proposal.number} sent.`,
    });
  }
  await logActivity(db, actor, {
    action: "proposal.sent",
    summary: `Proposal ${proposal.number} sent to ${proposal.companyName}`,
    entityType: "proposal",
    entityId: id,
  });
}

export async function markProposalViewed(db: DbOrTx, id: string): Promise<void> {
  await db
    .update(proposals)
    .set({
      viewedAt: new Date(),
      status: sql`case when ${proposals.status} = 'sent' then 'viewed' else ${proposals.status} end`,
    })
    .where(and(eq(proposals.id, id), sql`${proposals.viewedAt} is null`));
}

export const acceptanceSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name."),
  email: z.email("Please enter your email address."),
  role: z.string().trim().max(120).optional(),
  agree: z.literal("on", { error: "Please confirm you accept the terms." }),
});

/** Public acceptance: records the signature and starts onboarding. */
export async function acceptProposal(
  db: Db,
  token: string,
  input: z.infer<typeof acceptanceSchema>,
  ipAddress?: string,
): Promise<{ organisationId: string; invoiceId: string | null }> {
  const data = await getProposalByToken(db, token);
  if (!data) throw new AppError("NOT_FOUND");
  const { proposal } = data;
  if (proposal.status === "accepted" && proposal.organisationId)
    return { organisationId: proposal.organisationId, invoiceId: null };
  if (
    proposal.status === "declined" ||
    proposal.status === "expired" ||
    proposal.status === "draft"
  )
    throw new AppError("CONFLICT", {
      userMessage: "This proposal can no longer be accepted. Please contact us.",
    });
  if (proposal.validUntil && proposal.validUntil < new Date())
    throw new AppError("CONFLICT", {
      userMessage: "This proposal has expired. Please contact us for an updated one.",
    });

  const { onboardFromProposal } = await import("@/modules/onboarding/service");
  const result = await db.transaction(async (tx) => {
    await tx
      .update(proposals)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByName: input.name,
        acceptedByEmail: input.email.toLowerCase(),
        acceptedIp: ipAddress,
      })
      .where(eq(proposals.id, proposal.id));
    return onboardFromProposal(tx, proposal.id, {
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
    });
  });
  await emitEvent(db, "proposal.accepted", result.organisationId, { proposalId: proposal.id });
  await notifyStaff(db, {
    kind: "proposal.accepted",
    title: `Proposal accepted: ${proposal.companyName}`,
    body: `${input.name} accepted ${proposal.number}.`,
    link: `/workspace/clients/${result.organisationId}`,
  });
  const company = await getPlatformSetting(db, "company");
  await sendEmail(db, {
    to: { email: company.email, name: company.tradingName },
    template: "proposalAccepted",
    category: "notification",
    email: emailTemplates.proposalAccepted({
      company: proposal.companyName,
      url: absoluteUrl(`/workspace/clients/${result.organisationId}`),
    }),
    idempotencyKey: `accepted:${proposal.id}`,
  });
  return result;
}

export async function declineProposal(db: DbOrTx, token: string, reason?: string): Promise<void> {
  const data = await getProposalByToken(db, token);
  if (!data || data.proposal.status === "accepted") return;
  await db
    .update(proposals)
    .set({ status: "declined", declinedAt: new Date() })
    .where(eq(proposals.id, data.proposal.id));
  if (data.proposal.leadId) {
    await db
      .update(leads)
      .set({ stage: "lost", lostReason: reason || "Declined proposal" })
      .where(eq(leads.id, data.proposal.leadId));
  }
  await notifyStaff(db, {
    kind: "proposal.declined",
    title: `Proposal declined: ${data.proposal.companyName}`,
    body: reason,
  });
}

export function formatProposalMoney(minor: number, currency: string): string {
  return formatMoney(money(minor, isCurrency(currency) ? currency : "ZAR"));
}
