/**
 * Database commands:
 *   pnpm db:migrate   apply migrations
 *   pnpm db:seed      apply migrations, then seed base data (+ demo data outside production)
 *   pnpm db:reset     DEVELOPMENT ONLY: delete the embedded database and start again
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

const handle = createDb();
await runMigrations(handle);
console.log(`Migrations applied (${handle.driver}).`);
if (command === "seed" || command === "reset") {
  await ensureSeeded(handle.db);
  console.log("Seed complete.");
}
await handle.close();
