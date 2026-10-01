import { desc, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { leads } from "@/db/schema";
import { requireApiKey } from "@/modules/api-keys/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "read:pipeline");
  if ("error" in auth) return auth.error;
  const rows = await auth.db
    .select()
    .from(leads)
    .where(ne(leads.stage, "archived"))
    .orderBy(desc(leads.createdAt))
    .limit(500);
  return NextResponse.json({
    leads: rows.map((l) => ({
      id: l.id,
      company: l.company,
      stage: l.stage,
      source: l.source,
      fit: l.score?.fit.level ?? null,
      estimatedMonthlyMinor: l.estimatedMonthlyMinor,
      lastActivityAt: l.lastActivityAt,
      createdAt: l.createdAt,
    })),
  });
}
