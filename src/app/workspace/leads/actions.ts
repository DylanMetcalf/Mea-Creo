"use server";

import { and, desc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { audits, LEAD_STAGES, leadActivities, leads } from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { enqueue } from "@/jobs/queue";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { fromMajor } from "@/lib/money";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { normaliseWebsiteUrl } from "@/modules/audits/fetcher";
import { qualifyLead } from "@/modules/leads/qualify";
import { emitEvent } from "@/modules/notifications/service";
import { createClientOrganisation } from "@/modules/onboarding/service";
import { createProposalFromLead } from "@/modules/proposals/service";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

const leadSchema = z.object({
  company: z.string().trim().min(2, "Enter the company name.").max(160),
  website: optionalText(300),
  contactName: optionalText(120),
  contactRole: optionalText(120),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: optionalText(40),
  linkedinUrl: optionalText(300),
  industry: optionalText(120),
  location: optionalText(120),
  employeeRange: optionalText(20),
  goal: optionalText(500),
  source: z.enum(["manual", "referral", "linkedin", "outreach", "import"]).default("manual"),
  estimatedMonthly: optionalText(20),
  consent: z.string().optional(),
});

export async function createLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(leadSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const website = d.website ? normaliseWebsiteUrl(d.website).origin : null;
    const [lead] = await db
      .insert(leads)
      .values({
        company: d.company,
        website,
        contactName: d.contactName,
        contactRole: d.contactRole,
        email: d.email || null,
        phone: d.phone,
        linkedinUrl: d.linkedinUrl,
        industry: d.industry,
        location: d.location,
        employeeRange: d.employeeRange,
        goal: d.goal,
        source: d.source,
        ownerId: ctx.user.id,
        estimatedMonthlyMinor: d.estimatedMonthly
          ? fromMajor(d.estimatedMonthly.replace(/[^\d.]/g, "") || "0").amountMinor
          : null,
        consentAt: d.consent === "on" ? new Date() : null,
        consentText:
          d.consent === "on" ? "Recorded by Mea Creo staff: contact agreed to be contacted." : null,
        lastActivityAt: new Date(),
      })
      .returning({ id: leads.id });
    id = lead.id;
    const q = qualifyLead({ industry: d.industry, employeeRange: d.employeeRange, goal: d.goal });
    await db
      .update(leads)
      .set({ score: q.score, recommendedServices: q.recommendedServices })
      .where(eq(leads.id, lead.id));
    await db.insert(leadActivities).values({
      leadId: lead.id,
      type: "note",
      summary: "Lead added manually.",
      actorId: ctx.user.id,
    });
    await emitEvent(db, "lead.created", null, { leadId: lead.id, source: d.source });
    if (website && formData.get("runAudit") === "on") {
      const [audit] = await db
        .insert(audits)
        .values({
          leadId: lead.id,
          url: `${website}/`,
          companyName: d.company,
          publicToken: randomToken(18),
          requestedById: ctx.user.id,
        })
        .returning({ id: audits.id });
      await enqueue(db, "audit.run", { auditId: audit.id });
      kickJobs();
    }
  }, formData);
  if (id) redirect(`/workspace/leads/${id}`);
  return state;
}

/** CSV import: company,website,contact_name,email,industry,location (header row required). */
export async function importLeadsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, fieldErrors: { file: ["Choose a CSV file."] } };
    if (file.size > 2_000_000)
      return { ok: false, fieldErrors: { file: ["CSV files can be up to 2 MB."] } };
    const text = await file.text();
    const [header, ...rows] = text.split(/\r?\n/).filter((l) => l.trim());
    const cols = header.split(",").map((c) => c.trim().toLowerCase());
    const idx = (name: string) => cols.indexOf(name);
    if (idx("company") < 0) return { ok: false, message: "The CSV needs a 'company' column." };
    const db = await getDb();
    let imported = 0;
    for (const row of rows.slice(0, 1000)) {
      const cells = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const company = cells[idx("company")];
      if (!company) continue;
      const get = (name: string) => (idx(name) >= 0 ? cells[idx(name)] || null : null);
      await db.insert(leads).values({
        company,
        website: get("website"),
        contactName: get("contact_name"),
        email: get("email"),
        industry: get("industry"),
        location: get("location"),
        source: "import",
        ownerId: ctx.user.id,
      });
      imported++;
    }
    await logActivity(db, userActor(ctx.user), {
      action: "leads.imported",
      summary: `Imported ${imported} leads from CSV`,
    });
    refresh();
    return {
      ok: true,
      message: `Imported ${imported} lead${imported === 1 ? "" : "s"}. Imported contacts have no consent recorded. Only contact them where you have a lawful basis.`,
    };
  }, formData);
}

export async function updateLeadStageAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("leads.write");
  const db = await getDb();
  const leadId = str(formData, "leadId");
  const stage = z.enum(LEAD_STAGES).parse(str(formData, "stage"));
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) throw new AppError("NOT_FOUND");
  await db
    .update(leads)
    .set({
      stage,
      lostReason: stage === "lost" ? str(formData, "reason") || lead.lostReason : lead.lostReason,
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, leadId));
  await db.insert(leadActivities).values({
    leadId,
    type: "stage_change",
    summary: `Stage changed from ${lead.stage} to ${stage}.`,
    actorId: ctx.user.id,
  });
  await logActivity(db, userActor(ctx.user), {
    action: "lead.stage",
    summary: `${lead.company}: ${lead.stage} → ${stage}`,
    entityType: "lead",
    entityId: leadId,
    before: { stage: lead.stage },
    after: { stage },
  });
  refresh();
}

export async function leadNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const summary = str(formData, "summary").trim();
    if (!summary) return { ok: false, fieldErrors: { summary: ["Write something first."] } };
    const type = z
      .enum(["note", "call", "email", "meeting"])
      .parse(str(formData, "type") || "note");
    const db = await getDb();
    await db.insert(leadActivities).values({
      leadId: str(formData, "leadId"),
      type,
      summary: summary.slice(0, 2000),
      actorId: ctx.user.id,
    });
    await db
      .update(leads)
      .set({ lastActivityAt: new Date() })
      .where(eq(leads.id, str(formData, "leadId")));
    refresh();
    return { ok: true };
  }, formData);
}

export async function updateLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireStaff("leads.write");
    const parsed = parseForm(leadSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const leadId = str(formData, "leadId");
    const [audit] = await db
      .select({ result: audits.result })
      .from(audits)
      .where(and(eq(audits.leadId, leadId), eq(audits.status, "complete")))
      .orderBy(desc(audits.completedAt))
      .limit(1);
    const q = qualifyLead({
      industry: d.industry,
      employeeRange: d.employeeRange,
      goal: d.goal,
      audit: audit?.result ?? null,
    });
    await db
      .update(leads)
      .set({
        company: d.company,
        website: d.website ? normaliseWebsiteUrl(d.website).origin : null,
        contactName: d.contactName,
        contactRole: d.contactRole,
        email: d.email || null,
        phone: d.phone,
        linkedinUrl: d.linkedinUrl,
        industry: d.industry,
        location: d.location,
        employeeRange: d.employeeRange,
        goal: d.goal,
        estimatedMonthlyMinor: d.estimatedMonthly
          ? fromMajor(d.estimatedMonthly.replace(/[^\d.]/g, "") || "0").amountMinor
          : null,
        score: q.score,
        recommendedServices: q.recommendedServices,
      })
      .where(eq(leads.id, leadId));
    refresh();
    return { ok: true, message: "Saved and re-qualified." };
  }, formData);
}

export async function runLeadAuditAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("audits.run");
  const db = await getDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, str(formData, "leadId")));
  if (!lead?.website)
    throw new AppError("VALIDATION", { userMessage: "Add the lead's website first." });
  const [audit] = await db
    .insert(audits)
    .values({
      leadId: lead.id,
      url: normaliseWebsiteUrl(lead.website).href,
      companyName: lead.company,
      publicToken: randomToken(18),
      requestedById: ctx.user.id,
    })
    .returning({ id: audits.id });
  await enqueue(db, "audit.run", { auditId: audit.id });
  kickJobs();
  redirect(`/workspace/audits/${audit.id}`);
}

export async function createProposalAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("proposals.write");
  const id = await createProposalFromLead(await getDb(), str(formData, "leadId"), {
    id: ctx.user.id,
    name: ctx.user.name,
  });
  redirect(`/workspace/proposals/${id}`);
}

/** Converts a lead to a client without a proposal (e.g. a signed contract outside the system). */
export async function convertLeadAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("clients.write");
  const db = await getDb();
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, str(formData, "leadId")));
  if (!lead) throw new AppError("NOT_FOUND");
  if (lead.clientOrganisationId) redirect(`/workspace/clients/${lead.clientOrganisationId}`);
  const orgId = await createClientOrganisation(db, {
    name: lead.company,
    website: lead.website,
    industry: lead.industry,
    location: lead.location,
    employeeRange: lead.employeeRange,
    accountManagerId: ctx.user.id,
  });
  await db
    .update(leads)
    .set({ stage: "onboarding", clientOrganisationId: orgId })
    .where(eq(leads.id, lead.id));
  await logActivity(db, userActor(ctx.user), {
    organisationId: orgId,
    action: "lead.converted",
    summary: `Converted lead ${lead.company} to a client`,
  });
  redirect(`/workspace/clients/${orgId}`);
}
