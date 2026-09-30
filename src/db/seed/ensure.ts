import type { Db } from "@/db";
import { logger } from "@/lib/logger";
import { seedBase } from "./base";

/** Demo data is on by default outside production and can be disabled with DEMO_MODE=false. */
export function demoModeEnabled(): boolean {
  return process.env.APP_ENV !== "production" && process.env.DEMO_MODE !== "false";
}

/** Seeds the base business data (always) and the demo data (development/demo only). */
export async function ensureSeeded(db: Db): Promise<void> {
  const { created } = await seedBase(db);
  if (created) logger.info("Seeded Mea Creo base data");
  if (demoModeEnabled()) {
    const { seedDemo } = await import("./demo");
    await seedDemo(db);
  }
}
