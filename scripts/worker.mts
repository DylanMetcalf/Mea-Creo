/**
 * Background worker: processes queued jobs and runs scheduled work.
 *   pnpm worker
 * Run one (or more) alongside the web process in production.
 */
import { getDb } from "@/db";
import { JOB_HANDLERS } from "@/jobs/handlers";
import { enqueue, processJobs } from "@/jobs/queue";
import { logger } from "@/lib/logger";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const db = await getDb();
logger.info("worker started");

let lastDaily = "";
let lastEvents = 0;
while (!stopping) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastDaily) {
    await enqueue(db, "billing.daily", {});
    lastDaily = today;
  }
  if (Date.now() - lastEvents > 30_000) {
    await enqueue(db, "events.process", {}, { maxAttempts: 1 });
    lastEvents = Date.now();
  }
  const processed = await processJobs(db, JOB_HANDLERS, 25);
  if (processed === 0) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
logger.info("worker stopped");
process.exit(0);
