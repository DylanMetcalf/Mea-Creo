import { createDb, type Db, runMigrations, setDbForTesting } from "@/db";
import { seedBase } from "@/db/seed/base";

/** A fresh in-memory Postgres (PGlite) with migrations and the base seed applied. */
export async function testDb(): Promise<{
  db: Db;
  platformId: string;
  internalOrgId: string;
  close: () => Promise<void>;
}> {
  const handle = createDb({ pgliteDir: "memory://" });
  await runMigrations(handle);
  setDbForTesting(handle);
  const { platformId, internalOrgId } = await seedBase(handle.db);
  return { db: handle.db, platformId, internalOrgId, close: handle.close };
}
