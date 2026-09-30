import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { rateLimits } from "@/db/schema";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limit stored in Postgres. Returns the number of hits in the
 * current window and whether the limit was exceeded.
 */
export async function hitRateLimit(
  db: DbOrTx,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ count: number; limited: boolean }> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then ${resetAt.toISOString()}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  const count = row?.count ?? 1;
  return { count, limited: count > limit };
}

export async function enforceRateLimit(
  db: DbOrTx,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { limited } = await hitRateLimit(db, key, limit, windowSeconds);
  if (limited) throw new AppError("RATE_LIMITED");
}
