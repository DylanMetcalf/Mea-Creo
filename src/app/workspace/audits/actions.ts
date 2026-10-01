"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { audits, leadActivities, leads } from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { enqueue } from "@/jobs/queue";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { requireStaff } from "@/modules/auth/context";
import { normaliseWebsiteUrl } from "@/modules/audits/fetcher";
import { qualifyLead } from "@/modules/leads/qualify";

const adHocSchema = z.object({
  url: z.string().trim().min(4, "Enter a website address.").max(300),
  companyName: optionalText(160),
});

/** Runs a Visibility Report on any website, without creating a lead yet. */
export async function runAdHocAuditAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("audits.run");
    const parsed = parseForm(adHocSchema, formData);
    if (!parsed.success) return parsed.state;
    let url: URL;
    try {
      url = normaliseWebsiteUrl(parsed.data.url);
    } catch {
      return { ok: false, fieldErrors: { url: ["That doesn't look like a website address."] } };
    }
    const db = await getDb();
    const [audit] = await db
      .insert(audits)
      .values({
        url: url.href,
        companyName: parsed.data.companyName,
        publicToken: randomToken(18),
        requestedById: ctx.user.id,
      })
      .returning({ id: audits.id });
    await enqueue(db, "audit.run", { auditId: audit.id });
    kickJobs();
    id = audit.id;
  }, formData);
  if (id) redirect(`/workspace/audits/${id}`);
  return state;
}

/** Turns an ad-hoc audit into a lead, qualified with the audit result. */
export async function saveAuditAsLeadAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("leads.write");
  const db = await getDb();
  const [audit] = await db
    .select()
    .from(audits)
    .where(eq(audits.id, String(formData.get("auditId"))));
  if (!audit) throw new AppError("NOT_FOUND");
  if (audit.leadId) redirect(`/workspace/leads/${audit.leadId}`);
  if (audit.organisationId)
    throw new AppError("CONFLICT", { userMessage: "This report belongs to a client." });
  const origin = new URL(audit.url).origin;
  const company = audit.companyName ?? new URL(audit.url).hostname.replace(/^www\./, "");
  const q = qualifyLead({ audit: audit.result ?? null });
  const [lead] = await db
    .insert(leads)
    .values({
      company,
      website: origin,
      source: "manual",
      stage: audit.result ? "audit_generated" : "new",
      ownerId: ctx.user.id,
      score: q.score,
      recommendedServices: q.recommendedServices,
      opportunitySummary: audit.result?.headline ?? null,
      lastActivityAt: new Date(),
    })
    .returning({ id: leads.id });
  await db.update(audits).set({ leadId: lead.id }).where(eq(audits.id, audit.id));
  await db
    .insert(leadActivities)
    .values({
      leadId: lead.id,
      type: "note",
      summary: "Lead created from a Visibility Report.",
      actorId: ctx.user.id,
    });
  redirect(`/workspace/leads/${lead.id}`);
}

/** Re-runs a report for the same website and link. */
export async function rerunAuditAction(formData: FormData): Promise<void> {
  const ctx = await requireStaff("audits.run");
  const db = await getDb();
  const [audit] = await db
    .select()
    .from(audits)
    .where(eq(audits.id, String(formData.get("auditId"))));
  if (!audit) throw new AppError("NOT_FOUND");
  const [next] = await db
    .insert(audits)
    .values({
      url: audit.url,
      companyName: audit.companyName,
      leadId: audit.leadId,
      organisationId: audit.organisationId,
      kind: audit.kind,
      publicToken: randomToken(18),
      requestedById: ctx.user.id,
    })
    .returning({ id: audits.id });
  await enqueue(db, "audit.run", { auditId: next.id });
  kickJobs();
  redirect(`/workspace/audits/${next.id}`);
}
