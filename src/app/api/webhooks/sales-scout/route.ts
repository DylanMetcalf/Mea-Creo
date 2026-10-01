import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { logActivity } from "@/modules/activity/log";
import {
  importSalesScoutLeads,
  SALES_SCOUT_SIGNATURE_HEADER,
  salesScoutPayload,
  verifySalesScoutSignature,
} from "@/modules/integrations/sales-scout";

export const dynamic = "force-dynamic";

/** Inbound leads from Sales Scout, signed with HMAC-SHA256 of the raw body. REQUIRES CONFIGURATION. */
export async function POST(request: Request) {
  const env = getEnv();
  if (env.CRM_PROVIDER !== "sales_scout" || !env.SALES_SCOUT_WEBHOOK_SECRET)
    return NextResponse.json({ error: "Sales Scout is not connected." }, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 512_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  if (
    !verifySalesScoutSignature(
      env.SALES_SCOUT_WEBHOOK_SECRET,
      rawBody,
      request.headers.get(SALES_SCOUT_SIGNATURE_HEADER),
    )
  ) {
    logger.warn("sales scout webhook: bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = salesScoutPayload.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) },
      { status: 422 },
    );
  const db = await getDb();
  const result = await importSalesScoutLeads(db, parsed.data);
  await logActivity(
    db,
    { type: "webhook", label: "sales_scout" },
    {
      action: "leads.imported",
      summary: `Sales Scout: ${result.created} new, ${result.updated} updated leads`,
    },
  );
  return NextResponse.json({ ok: true, ...result });
}
