import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { leadActivities, leads } from "@/db/schema";
import { hmacSha256, safeEqual } from "@/lib/crypto";
import { qualifyLead } from "@/modules/leads/qualify";
import { emitEvent } from "@/modules/notifications/service";

export const SALES_SCOUT_SIGNATURE_HEADER = "x-sales-scout-signature";

/** Payload Sales Scout posts. Unknown fields are ignored; nothing here is trusted beyond its type. */
export const salesScoutPayload = z.object({
  leads: z
    .array(
      z.object({
        externalId: z.string().min(1).max(120),
        company: z.string().trim().min(1).max(160),
        website: z.string().trim().max(300).optional(),
        industry: z.string().trim().max(120).optional(),
        location: z.string().trim().max(120).optional(),
        employeeRange: z.string().trim().max(20).optional(),
        contact: z
          .object({
            name: z.string().max(120).optional(),
            email: z.email().optional(),
            role: z.string().max(120).optional(),
          })
          .optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export function verifySalesScoutSignature(
  secret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  return safeEqual(hmacSha256(secret, rawBody), signature.replace(/^sha256=/, ""));
}

/**
 * Imports leads idempotently (by external id). Imported leads carry no consent: outreach
 * to them still goes through approval and must have a lawful basis.
 */
export async function importSalesScoutLeads(
  db: DbOrTx,
  payload: z.infer<typeof salesScoutPayload>,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const l of payload.leads) {
    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.source, "sales_scout"), eq(leads.externalId, l.externalId)))
      .limit(1);
    const values = {
      company: l.company,
      website: l.website || null,
      industry: l.industry || null,
      location: l.location || null,
      employeeRange: l.employeeRange || null,
      contactName: l.contact?.name || null,
      contactRole: l.contact?.role || null,
      email: l.contact?.email?.toLowerCase() || null,
    };
    const q = qualifyLead({ industry: values.industry, employeeRange: values.employeeRange });
    if (existing) {
      await db
        .update(leads)
        .set({ ...values, score: q.score, recommendedServices: q.recommendedServices })
        .where(eq(leads.id, existing.id));
      updated++;
    } else {
      const [row] = await db
        .insert(leads)
        .values({
          ...values,
          source: "sales_scout",
          externalId: l.externalId,
          message: l.notes || null,
          score: q.score,
          recommendedServices: q.recommendedServices,
          lastActivityAt: new Date(),
        })
        .returning({ id: leads.id });
      await db
        .insert(leadActivities)
        .values({ leadId: row.id, type: "note", summary: "Imported from Sales Scout." });
      await emitEvent(db, "lead.created", null, { leadId: row.id, source: "sales_scout" });
      created++;
    }
  }
  return { created, updated };
}
