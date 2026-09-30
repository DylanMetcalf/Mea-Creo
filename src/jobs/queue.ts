import { and, eq, lte, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import { jobs } from "@/db/schema";
import { logger } from "@/lib/logger";

export type JobHandler = (payload: Record<string, unknown>, db: Db) => Promise<void>;

/**
 * Minimal durable job queue on PostgreSQL.
 *
 * - `enqueue` inserts a row (can be part of the caller's transaction).
 * - `processJobs` claims ready jobs with FOR UPDATE SKIP LOCKED, so several workers
 *   can run safely, retries failures with exponential backoff up to maxAttempts.
 *
 * In development the web process drains the queue after each request that enqueues
 * work (see `kickJobs`); in production run `pnpm worker` as a separate process.
 */
export async function enqueue(
  db: DbOrTx,
  type: string,
  payload: Record<string, unknown>,
  options: { runAt?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const [row] = await db
    .insert(jobs)
    .values({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 3,
    })
    .returning({ id: jobs.id });
  return row.id;
}

async function claim(db: Db): Promise<typeof jobs.$inferSelect | null> {
  // Reclaim jobs stuck in "running" for over 10 minutes (crashed worker).
  await db
    .update(jobs)
    .set({ status: "queued", lockedAt: null })
    .where(
      and(eq(jobs.status, "running"), lte(jobs.lockedAt, new Date(Date.now() - 10 * 60 * 1000))),
    );

  const result = await db.execute(sql`
    update ${jobs} set status = 'running', locked_at = now(), attempts = attempts + 1
    where id = (
      select id from ${jobs}
      where status = 'queued' and run_at <= now()
      order by run_at
      limit 1
      for update skip locked
    )
    returning id`);
  const rows = (Array.isArray(result) ? result : (result as { rows: { id: string }[] }).rows) as {
    id: string;
  }[];
  const id = rows[0]?.id;
  if (!id) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job ?? null;
}

export async function processJobs(
  db: Db,
  handlers: Record<string, JobHandler>,
  maxJobs = 20,
): Promise<number> {
  let processed = 0;
  for (; processed < maxJobs; processed++) {
    const job = await claim(db);
    if (!job) break;
    const handler = handlers[job.type];
    try {
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      await handler(job.payload, db);
      await db
        .update(jobs)
        .set({ status: "succeeded", finishedAt: new Date(), lastError: null })
        .where(eq(jobs.id, job.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const finalAttempt = job.attempts >= job.maxAttempts;
      logger.error(
        { jobId: job.id, type: job.type, attempt: job.attempts, err: message },
        "job failed",
      );
      await db
        .update(jobs)
        .set({
          status: finalAttempt ? "failed" : "queued",
          lastError: message.slice(0, 2000),
          lockedAt: null,
          runAt: new Date(Date.now() + 2 ** job.attempts * 15_000),
          finishedAt: finalAttempt ? new Date() : null,
        })
        .where(eq(jobs.id, job.id));
    }
  }
  return processed;
}
