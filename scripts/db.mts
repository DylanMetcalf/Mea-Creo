/**
 * Database commands:
 *   pnpm db:migrate   apply migrations
 *   pnpm db:seed      apply migrations, then seed base data (+ demo data outside production)
 *   pnpm db:reset     DEVELOPMENT ONLY: delete the embedded database and start again
 *   pnpm db:deploy    at deploy time (Vercel build): migrations + base data, never demo data
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { createDb, runMigrations } from "@/db";
import { ensureSeeded } from "@/db/seed/ensure";

const command = process.argv[2];

if (command === "reset") {
  if (process.env.APP_ENV === "production" || process.env.DATABASE_URL) {
    console.error("db:reset only works with the embedded development database.");
    process.exit(1);
  }
  await rm(path.join(process.cwd(), ".data"), { recursive: true, force: true });
  console.log("Deleted .data (embedded database and local uploads).");
}

if (command === "deploy") {
  // Runs before every Vercel build, so the database is always ready for the new code.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    if (process.env.APP_ENV === "production") {
      console.error("DATABASE_URL is missing. Add it in the host's environment variables.");
      process.exit(1);
    }
    console.log("No DATABASE_URL: skipping database preparation (preview without a database).");
    process.exit(0);
  }
  const { seedBase } = await import("@/db/seed/base");
  const deploy = createDb({ url });
  await runMigrations(deploy);
  await seedBase(deploy.db);
  console.log("Database ready: migrations applied, base data in place.");
  await deploy.close();
  process.exit(0);
}

const handle = createDb();
await runMigrations(handle);
console.log(`Migrations applied (${handle.driver}).`);
if (command === "seed" || command === "reset") {
  await ensureSeeded(handle.db);
  console.log("Seed complete.");
}
await handle.close();
