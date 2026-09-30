import type { DbOrTx } from "@/db";
import { activityLog } from "@/db/schema";

export type Actor =
  | { type: "user"; id: string; label: string }
  | { type: "client"; id: string; label: string }
  | { type: "agent"; id: string; label?: string }
  | { type: "system"; label?: string }
  | { type: "webhook"; label: string };

export interface LogEntry {
  organisationId?: string | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
}

/**
 * Append-only audit trail: who did what, when, to which record, the old and new
 * values, the source (human, client, agent, system, webhook) and why.
 */
export async function logActivity(db: DbOrTx, actor: Actor, entry: LogEntry): Promise<void> {
  await db.insert(activityLog).values({
    organisationId: entry.organisationId ?? null,
    actorType: actor.type,
    actorId: "id" in actor ? actor.id : null,
    actorLabel: actor.label ?? ("id" in actor ? actor.id : actor.type),
    action: entry.action,
    summary: entry.summary,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    reason: entry.reason,
    ipAddress: entry.ipAddress,
  });
}

export function userActor(user: { id: string; name: string }, asClient = false): Actor {
  return asClient
    ? { type: "client", id: user.id, label: user.name }
    : { type: "user", id: user.id, label: user.name };
}

export const SYSTEM: Actor = { type: "system", label: "System" };
