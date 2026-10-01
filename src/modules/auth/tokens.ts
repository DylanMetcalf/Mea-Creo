import { and, eq, gt, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { authTokens, TOKEN_PURPOSES } from "@/db/schema";
import type { Role } from "./permissions";
import { sha256 } from "@/lib/crypto";
import { randomToken } from "@/lib/ids";

type Purpose = (typeof TOKEN_PURPOSES)[number];

/** Creates a single-use token. Only its hash is stored. */
export async function createAuthToken(
  db: DbOrTx,
  input: {
    purpose: Purpose;
    email: string;
    userId?: string;
    organisationId?: string;
    role?: Role;
    invitedById?: string;
    ttlHours: number;
  },
): Promise<string> {
  const token = randomToken(32);
  await db.insert(authTokens).values({
    purpose: input.purpose,
    tokenHash: sha256(token),
    email: input.email.toLowerCase(),
    userId: input.userId,
    organisationId: input.organisationId,
    role: input.role,
    invitedById: input.invitedById,
    expiresAt: new Date(Date.now() + input.ttlHours * 3600_000),
  });
  return token;
}

/** Returns the token row if valid and unused (does not consume it). */
export async function findAuthToken(db: DbOrTx, token: string, purpose: Purpose) {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function consumeAuthToken(db: DbOrTx, id: string): Promise<void> {
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, id));
}
