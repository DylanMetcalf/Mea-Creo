import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { getDb } from "@/db";
import { safeEqual } from "@/lib/crypto";
import { runDailyCycle } from "@/modules/scheduler/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily cycle for hosts without a worker. Call once a day with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await runDailyCycle(await getDb());
  return NextResponse.json({ ok: true, ...result });
}
