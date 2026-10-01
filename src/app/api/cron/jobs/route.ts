import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { getDb } from "@/db";
import { JOB_HANDLERS } from "@/jobs/handlers";
import { enqueue, processJobs } from "@/jobs/queue";
import { safeEqual } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Drains queued jobs and processes domain events. Call every few minutes when there is no worker. */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getDb();
  await enqueue(db, "events.process", {}, { maxAttempts: 1 });
  const processed = await processJobs(db, JOB_HANDLERS, 50);
  return NextResponse.json({ ok: true, processed });
}
