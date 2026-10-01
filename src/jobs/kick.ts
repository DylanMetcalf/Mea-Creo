import "server-only";
import { after } from "next/server";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { JOB_HANDLERS } from "./handlers";
import { processJobs } from "./queue";

/**
 * Processes queued jobs after the current response has been sent.
 * Keeps the demo and small installs working without a separate worker. With
 * JOBS_INLINE=false, only the worker process (`pnpm worker`) runs jobs.
 */
export function kickJobs(): void {
  if (process.env.JOBS_INLINE === "false") return;
  after(async () => {
    try {
      const db = await getDb();
      // Drain in a few passes so jobs enqueued by jobs (e.g. events) also run.
      for (let pass = 0; pass < 3; pass++) {
        const processed = await processJobs(db, JOB_HANDLERS, 10);
        if (processed === 0) break;
      }
    } catch (error) {
      logger.error({ err: String(error) }, "inline job processing failed");
    }
  });
}
