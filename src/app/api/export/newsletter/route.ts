import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { logActivity, userActor } from "@/modules/activity/log";
import { getAuthContext } from "@/modules/auth/context";
import { listSubscribers, subscribersCsv } from "@/modules/newsletter/service";

export const dynamic = "force-dynamic";

/** CSV of current newsletter subscribers. Staff with data.export only; logged. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx || ctx.kind !== "staff" || !ctx.can("data.export"))
    return new NextResponse("Not found", { status: 404 });
  const db = await getDb();
  const csv = subscribersCsv(await listSubscribers(db));
  await logActivity(db, userActor(ctx.user), {
    action: "newsletter.exported",
    summary: "Exported newsletter subscribers (CSV)",
  });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mea-creo-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
