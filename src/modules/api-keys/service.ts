import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { apiKeys } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { randomToken } from "@/lib/ids";

/** Scopes an API key can hold (Founder OS, Sales Scout and future integrations). */
export const API_SCOPES = [
  "read:business",
  "read:clients",
  "read:pipeline",
  "write:leads",
  "read:tasks",
  "write:tasks",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Creates a key. The raw key is returned once and only its hash is stored. */
export async function createApiKey(
  db: DbOrTx,
  input: { name: string; scopes: ApiScope[]; createdById: string },
): Promise<{ id: string; key: string }> {
  const prefix = randomToken(6)
    .replace(/[^A-Za-z0-9]/g, "x")
    .slice(0, 8);
  const key = `mc_${prefix}_${randomToken(32)}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: input.name,
      prefix,
      keyHash: sha256(key),
      scopes: input.scopes,
      createdById: input.createdById,
    })
    .returning({ id: apiKeys.id });
  return { id: row.id, key };
}

/** Verifies a raw key (from `Authorization: Bearer …`). Returns the key row or null. */
export async function verifyApiKey(db: DbOrTx, raw: string | null | undefined, scope: ApiScope) {
  if (!raw || !/^mc_[A-Za-z0-9]{1,8}_[A-Za-z0-9_-]{20,}$/.test(raw)) return null;
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, sha256(raw)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row || !row.scopes.includes(scope)) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row;
}

export async function revokeApiKey(db: DbOrTx, id: string) {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
}
