import { sql } from "drizzle-orm";
import type { Db } from "@/db";

/**
 * Enables row level security on every table in the public schema that doesn't have it yet.
 * With no policies, roles other than the table owner (Supabase's anon and authenticated
 * API roles) can read or write nothing. Returns how many tables were changed.
 */
export async function lockDownPublicTables(db: Db): Promise<number> {
  const result = await db.execute<{ tablename: string }>(sql`
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: { tablename: string }[] }).rows;
  for (const { tablename } of rows) {
    await db.execute(sql`alter table ${sql.identifier(tablename)} enable row level security`);
  }
  return rows.length;
}
