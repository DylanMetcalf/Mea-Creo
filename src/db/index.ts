import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
/** A transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

interface DbHandle {
  db: Db;
  driver: "postgres" | "pglite";
  ready: Promise<void>;
  close: () => Promise<void>;
}

/**
 * Database connection.
 *
 * - `DATABASE_URL` set → PostgreSQL via postgres.js (staging/production, docker compose).
 * - Otherwise (development/demo/test only) → embedded PGlite, a real Postgres compiled to
 *   WebAssembly, stored in `.data/pglite` (or in memory with `PGLITE_DIR=memory://`).
 *   This lets the whole application, including the demo, run with zero infrastructure.
 */
export function createDb(options: { url?: string; pgliteDir?: string } = {}): DbHandle {
  const url = options.url ?? process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      onnotice: () => {},
    });
    const db = drizzlePostgres({ client, schema }) as unknown as Db;
    return { db, driver: "postgres", ready: Promise.resolve(), close: () => client.end() };
  }

  if (process.env.APP_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required in production. The embedded database is for development only.",
    );
  }

  const dir =
    options.pgliteDir ?? process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const client = dir === "memory://" ? new PGlite() : new PGlite(dir);
  const db = drizzlePglite({ client, schema }) as unknown as Db;
  return { db, driver: "pglite", ready: client.waitReady, close: () => client.close() };
}

export async function runMigrations(handle: DbHandle): Promise<void> {
  await handle.ready;
  if (handle.driver === "pglite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(handle.db as any, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePostgres(handle.db as any, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}

// One handle per process. Stored on globalThis so dev hot-reloads and duplicated
// module instances never open a second embedded database on the same directory.
const globalForDb = globalThis as unknown as {
  __meaCreoDb?: { handle: DbHandle; prepared: Promise<void> };
};

/**
 * Returns the ready database. With the embedded database in development, pending
 * migrations are applied and demo data is seeded automatically on first use.
 */
export async function getDb(): Promise<Db> {
  if (!globalForDb.__meaCreoDb) {
    const handle = createDb();
    const prepared = (async () => {
      await handle.ready;
      if (handle.driver === "pglite" && process.env.APP_ENV !== "test") {
        await runMigrations(handle);
        if (process.env.DEMO_AUTO_SEED !== "false") {
          const { ensureSeeded } = await import("./seed/ensure");
          await ensureSeeded(handle.db);
        }
      }
    })();
    globalForDb.__meaCreoDb = { handle, prepared };
  }
  await globalForDb.__meaCreoDb.prepared;
  return globalForDb.__meaCreoDb.handle.db;
}

/** Test helper: install a specific database as the process database. */
export function setDbForTesting(handle: DbHandle): void {
  globalForDb.__meaCreoDb = { handle, prepared: Promise.resolve() };
}
