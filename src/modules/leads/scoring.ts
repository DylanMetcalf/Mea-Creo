import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { audits, leads } from "@/db/schema";
import { getPlatformSetting } from "@/modules/settings/service";
import { qualifyLead, type QualificationConfig, type Qualification } from "./qualify";

const ENGAGED_STAGES = [
  "call_booked",
  "call_completed",
  "proposal_draft",
  "proposal_sent",
  "negotiation",
];

/** Qualification rules as configured in Settings → Qualification and Targets. */
export async function loadQualificationConfig(db: DbOrTx): Promise<QualificationConfig> {
  const [q, targets] = await Promise.all([
    getPlatformSetting(db, "qualification"),
    getPlatformSetting(db, "targets"),
  ]);
  return {
    ...q,
    minimumMonthlyValueMinor: targets.minimumMonthlyValueMinor,
    targetAverageClientValueMinor: targets.targetAverageClientValueMinor,
  };
}

/**
 * Re-qualifies a lead from everything on record (details, latest Visibility Report,
 * research, decision makers) and saves the explained score and package recommendation.
 */
export async function rescoreLead(db: DbOrTx, leadId: string): Promise<Qualification | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return null;
  const [[audit], config] = await Promise.all([
    db
      .select({ result: audits.result })
      .from(audits)
      .where(and(eq(audits.leadId, leadId), eq(audits.status, "complete")))
      .orderBy(desc(audits.completedAt))
      .limit(1),
    loadQualificationConfig(db),
  ]);
  const q = qualifyLead(
    {
      industry: lead.industry,
      employeeRange: lead.employeeRange,
      goal: lead.goal,
      message: lead.message,
      audit: audit?.result ?? null,
      website: lead.website,
      source: lead.source,
      estimatedMonthlyMinor: lead.estimatedMonthlyMinor,
      contactName: lead.contactName,
      contactRole: lead.contactRole,
      email: lead.email,
      phone: lead.phone,
      decisionMakers: lead.decisionMakers,
      research: lead.research,
      engaged: ENGAGED_STAGES.includes(lead.stage),
    },
    config,
  );
  await db
    .update(leads)
    .set({
      score: q.score,
      recommendedServices: q.recommendedServices,
      recommendedPackage: q.recommendedPackage.ongoing ?? q.recommendedPackage.entry ?? null,
      opportunitySummary: q.opportunitySummary,
      outreachAngle: q.outreachAngle,
    })
    .where(eq(leads.id, leadId));
  return q;
}
