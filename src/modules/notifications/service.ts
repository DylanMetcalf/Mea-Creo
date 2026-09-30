import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { domainEvents, memberships, notifications, organisations } from "@/db/schema";
import type { Role } from "@/modules/auth/permissions";

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string;
  link?: string;
  organisationId?: string | null;
}

/** Notifies Mea Creo staff. Defaults to founders and managers. */
export async function notifyStaff(
  db: DbOrTx,
  input: NotificationInput,
  roles: Role[] = ["founder", "manager"],
): Promise<void> {
  const staff = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
    .where(and(eq(organisations.kind, "platform"), inArray(memberships.role, roles)));
  if (staff.length === 0) return;
  await db
    .insert(notifications)
    .values(
      staff.map((s) => ({
        userId: s.userId,
        ...input,
        organisationId: input.organisationId ?? null,
      })),
    );
}

export async function notifyUser(
  db: DbOrTx,
  userId: string,
  input: NotificationInput,
): Promise<void> {
  await db
    .insert(notifications)
    .values({ userId, ...input, organisationId: input.organisationId ?? null });
}

/** Notifies every portal user of a client organisation. */
export async function notifyClient(
  db: DbOrTx,
  organisationId: string,
  input: NotificationInput,
): Promise<string[]> {
  const members = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organisationId, organisationId));
  if (members.length > 0) {
    await db
      .insert(notifications)
      .values(members.map((m) => ({ userId: m.userId, ...input, organisationId })));
  }
  return members.map((m) => m.userId);
}

/** Records a domain event in the outbox (same transaction as the change that caused it). */
export async function emitEvent(
  db: DbOrTx,
  type: string,
  organisationId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(domainEvents).values({ type, organisationId, payload });
}
