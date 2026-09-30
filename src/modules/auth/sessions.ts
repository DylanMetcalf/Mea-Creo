import { and, eq, gt, lt } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { memberships, organisations, sessions, users } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { randomToken } from "@/lib/ids";

export const SESSION_COOKIE = "mc_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: DbOrTx,
  userId: string,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent?.slice(0, 300),
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return { token, expiresAt };
}

export interface SessionMembership {
  organisationId: string;
  organisationName: string;
  organisationKind: "platform" | "client";
  role: (typeof memberships.$inferSelect)["role"];
}

export interface ValidatedSession {
  sessionId: string;
  expiresAt: Date;
  renewed: boolean;
  activeOrganisationId: string | null;
  user: { id: string; email: string; name: string; isDemo: boolean };
  memberships: SessionMembership[];
}

/** Looks up a session by cookie token. Expired sessions and disabled users are rejected. */
export async function validateSession(db: DbOrTx, token: string): Promise<ValidatedSession | null> {
  if (!token || token.length > 200) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.disabledAt) return null;

  let expiresAt = row.session.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - Date.now() < RENEW_WHEN_REMAINING_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    renewed = true;
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
  }

  const rows = await db
    .select({
      organisationId: memberships.organisationId,
      role: memberships.role,
      organisationName: organisations.name,
      organisationKind: organisations.kind,
      archivedAt: organisations.archivedAt,
    })
    .from(memberships)
    .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
    .where(eq(memberships.userId, row.user.id));

  return {
    sessionId: id,
    expiresAt,
    renewed,
    activeOrganisationId: row.session.activeOrganisationId,
    user: { id: row.user.id, email: row.user.email, name: row.user.name, isDemo: row.user.isDemo },
    memberships: rows
      .filter((m) => !m.archivedAt)
      .map(({ organisationId, role, organisationName, organisationKind }) => ({
        organisationId,
        role,
        organisationName,
        organisationKind,
      })),
  };
}

export async function deleteSession(db: DbOrTx, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function deleteUserSessions(db: DbOrTx, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(db: DbOrTx): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function setActiveOrganisation(
  db: DbOrTx,
  sessionId: string,
  organisationId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ activeOrganisationId: organisationId })
    .where(eq(sessions.id, sessionId));
}
