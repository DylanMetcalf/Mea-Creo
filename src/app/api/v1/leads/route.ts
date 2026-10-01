import { NextResponse } from "next/server";
import { z } from "zod";
import { leadActivities, leads } from "@/db/schema";
import { requireApiKey } from "@/modules/api-keys/guard";
import { qualifyLead } from "@/modules/leads/qualify";
import { emitEvent } from "@/modules/notifications/service";

export const dynamic = "force-dynamic";

const body = z.object({
  company: z.string().trim().min(2).max(160),
  website: z.string().trim().max(300).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.email().optional(),
  industry: z.string().trim().max(120).optional(),
  employeeRange: z.string().trim().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

/** Creates a lead (e.g. from Founder OS). No consent is recorded for API-created leads. */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "write:leads");
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  const d = parsed.data;
  const q = qualifyLead({ industry: d.industry, employeeRange: d.employeeRange });
  const [lead] = await auth.db
    .insert(leads)
    .values({
      company: d.company,
      website: d.website || null,
      contactName: d.contactName || null,
      email: d.email?.toLowerCase() || null,
      industry: d.industry || null,
      employeeRange: d.employeeRange || null,
      message: d.notes || null,
      source: "manual",
      score: q.score,
      recommendedServices: q.recommendedServices,
      lastActivityAt: new Date(),
    })
    .returning({ id: leads.id });
  await auth.db
    .insert(leadActivities)
    .values({ leadId: lead.id, type: "note", summary: `Created via API key "${auth.key.name}".` });
  await emitEvent(auth.db, "lead.created", null, { leadId: lead.id, source: "api" });
  return NextResponse.json({ id: lead.id }, { status: 201 });
}
