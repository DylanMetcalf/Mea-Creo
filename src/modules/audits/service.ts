import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { audits, clients, competitors, leadActivities, leads } from "@/db/schema";
import { enqueue } from "@/jobs/queue";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, SYSTEM } from "@/modules/activity/log";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { rescoreLead } from "@/modules/leads/scoring";
import { emitEvent, notifyStaff } from "@/modules/notifications/service";
import { analyse, toCompetitorComparison } from "./analyse";
import { collectSignals, type Fetcher } from "./collect";
import { normaliseWebsiteUrl } from "./fetcher";
import type { AuditResult, CompetitorComparison } from "./types";

export const CONSENT_TEXT =
  "I agree that Mea Creo may store these details to prepare my report and contact me about it. See the privacy policy.";

export const visibilityReportSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  company: z.string().trim().min(2, "Please enter your company name.").max(160),
  email: z.email("Please enter a valid email address.").max(200),
  website: z.string().trim().min(4, "Please enter your website.").max(300),
  industry: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  employeeRange: z.string().trim().max(20).optional(),
  goal: z.string().trim().max(500).optional(),
  consent: z.literal(true, { error: "Please confirm we may contact you about your report." }),
  marketingOptIn: z.boolean().optional(),
  utm: z.record(z.string(), z.string().max(200)).optional(),
});
export type VisibilityReportInput = z.infer<typeof visibilityReportSchema>;

/** Public funnel entry: creates the lead, the queued audit and the background job. */
export async function requestVisibilityReport(
  db: Db,
  input: VisibilityReportInput,
): Promise<{ token: string; auditId: string; leadId: string }> {
  const url = normaliseWebsiteUrl(input.website);
  return db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        company: input.company,
        website: url.origin,
        contactName: input.name,
        email: input.email.toLowerCase(),
        industry: input.industry || null,
        location: input.location || null,
        employeeRange: input.employeeRange || null,
        goal: input.goal || null,
        source: "visibility_report",
        utm: input.utm ?? {},
        consentAt: new Date(),
        consentText: CONSENT_TEXT,
        marketingOptIn: input.marketingOptIn ?? false,
        lastActivityAt: new Date(),
      })
      .returning({ id: leads.id });
    const token = randomToken(18);
    const [audit] = await tx
      .insert(audits)
      .values({
        leadId: lead.id,
        kind: "visibility",
        url: url.href,
        companyName: input.company,
        publicToken: token,
      })
      .returning({ id: audits.id });
    await tx.insert(leadActivities).values({
      leadId: lead.id,
      type: "audit",
      summary: `Requested a Visibility Report for ${url.hostname}.`,
    });
    await emitEvent(tx, "lead.created", null, { leadId: lead.id, source: "visibility_report" });
    await enqueue(tx, "audit.run", { auditId: audit.id });
    return { token, auditId: audit.id, leadId: lead.id };
  });
}

/** Queues an audit of a client's site (optionally comparing competitors). */
export async function queueClientAudit(
  db: DbOrTx,
  input: { organisationId: string; requestedById?: string; kind?: "visibility" | "self" },
): Promise<string> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, input.organisationId))
    .limit(1);
  if (!client?.website)
    throw new AppError("VALIDATION", {
      userMessage: "Add the client's website before running an audit.",
    });
  const url = normaliseWebsiteUrl(client.website);
  const [audit] = await db
    .insert(audits)
    .values({
      organisationId: input.organisationId,
      kind: input.kind ?? (client.isInternal ? "self" : "visibility"),
      url: url.href,
      companyName: client.name,
      publicToken: randomToken(18),
      requestedById: input.requestedById,
    })
    .returning({ id: audits.id });
  await enqueue(db, "audit.run", { auditId: audit.id });
  return audit.id;
}

export async function getAuditByToken(db: DbOrTx, token: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const [audit] = await db.select().from(audits).where(eq(audits.publicToken, token)).limit(1);
  return audit ?? null;
}

export async function latestClientAudit(db: DbOrTx, organisationId: string) {
  const [audit] = await db
    .select()
    .from(audits)
    .where(and(eq(audits.organisationId, organisationId), eq(audits.status, "complete")))
    .orderBy(desc(audits.completedAt))
    .limit(1);
  return audit ?? null;
}

/** Runs a queued audit end to end. Safe to retry. */
export async function processAudit(
  db: Db,
  auditId: string,
  fetcher?: Fetcher,
): Promise<AuditResult | null> {
  const [audit] = await db.select().from(audits).where(eq(audits.id, auditId)).limit(1);
  if (!audit || audit.status === "complete") return audit?.result ?? null;
  await db
    .update(audits)
    .set({ status: "running", startedAt: new Date(), error: null })
    .where(eq(audits.id, auditId));
  const started = Date.now();

  try {
    const url = new URL(audit.url);
    const signals = await collectSignals(url, fetcher);

    const comparisons: CompetitorComparison[] = [];
    if (audit.organisationId) {
      const rivals = await db
        .select()
        .from(competitors)
        .where(eq(competitors.organisationId, audit.organisationId))
        .limit(3);
      for (const rival of rivals.filter((r) => r.website)) {
        try {
          const theirs = await collectSignals(normaliseWebsiteUrl(rival.website!), fetcher);
          comparisons.push(toCompetitorComparison(rival.name, rival.website!, signals, theirs));
        } catch (error) {
          comparisons.push({
            name: rival.name,
            url: rival.website!,
            highlights: ["We couldn't reach this competitor's website."],
            considerations: [],
          });
          logger.warn({ competitor: rival.website, err: String(error) }, "competitor fetch failed");
        }
      }
    }

    const result = analyse({
      url: audit.url,
      signals,
      competitors: comparisons,
      durationMs: Date.now() - started,
    });
    await db
      .update(audits)
      .set({ status: "complete", result, completedAt: new Date() })
      .where(eq(audits.id, auditId));
    await emitEvent(db, "audit.completed", audit.organisationId, { auditId, leadId: audit.leadId });

    if (audit.leadId) await afterLeadAudit(db, audit.leadId, audit.publicToken, result);
    return result;
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.userMessage
        : "We couldn't complete the analysis. Please try again later.";
    await db
      .update(audits)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(audits.id, auditId));
    await logActivity(db, SYSTEM, {
      organisationId: audit.organisationId,
      action: "audit.failed",
      summary: `Audit of ${audit.url} failed: ${message}`,
      entityType: "audit",
      entityId: auditId,
    });
    // User-facing failures (bad URL, site down) are final; don't burn retries on them.
    if (!(error instanceof AppError)) throw error;
    return null;
  }
}

async function afterLeadAudit(
  db: Db,
  leadId: string,
  token: string,
  result: AuditResult,
): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return;
  await db
    .update(leads)
    .set({
      stage: lead.stage === "new" ? "audit_generated" : lead.stage,
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, leadId));
  const qualification = await rescoreLead(db, leadId);
  await db
    .insert(leadActivities)
    .values({ leadId, type: "audit", summary: `Visibility Report generated: ${result.headline}` });
  await notifyStaff(db, {
    kind: "lead.audit",
    title: `New Visibility Report: ${lead.company}`,
    body: `${result.counts.critical + result.counts.improvements} opportunities found. Fit: ${qualification?.score.fit.level ?? "unknown"}.`,
    link: `/workspace/leads/${leadId}`,
  });
  if (lead.email) {
    await sendEmail(db, {
      to: { email: lead.email, name: lead.contactName ?? undefined },
      template: "auditReady",
      category: "transactional",
      email: emailTemplates.auditReady({
        name: lead.contactName ?? "there",
        company: lead.company,
        url: absoluteUrl(`/visibility-report/${token}`),
      }),
      idempotencyKey: `audit-ready:${token}`,
    });
  }
}
