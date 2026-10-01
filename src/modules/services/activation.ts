import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  clients,
  clientServices,
  OPEN_TASK_STATUSES,
  services,
  subscriptions,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { AppError } from "@/lib/errors";
import { type Actor, logActivity } from "@/modules/activity/log";
import { emitEvent } from "@/modules/notifications/service";

/** Recomputes the cached monthly value on the client from active services. */
export async function refreshMonthlyValue(db: DbOrTx, organisationId: string): Promise<void> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${clientServices.monthlyMinor}), 0)::bigint` })
    .from(clientServices)
    .where(
      and(
        eq(clientServices.organisationId, organisationId),
        inArray(clientServices.status, ["active", "paused"]),
      ),
    );
  await db
    .update(clients)
    .set({ monthlyValueMinor: Number(row?.total ?? 0) })
    .where(eq(clients.organisationId, organisationId));
}

/**
 * Activates pending services: setup tasks from the service's included activities,
 * a timeline entry, a subscription for monthly billing, and the service.activated event.
 */
export async function activatePendingServices(
  db: DbOrTx,
  organisationId: string,
  actor?: Actor,
): Promise<number> {
  const pending = await db
    .select({ cs: clientServices, service: services })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(eq(clientServices.organisationId, organisationId), eq(clientServices.status, "pending")),
    );
  for (const { cs, service } of pending) {
    await activateClientService(db, cs.id, actor, service);
  }
  await refreshMonthlyValue(db, organisationId);
  return pending.length;
}

export async function activateClientService(
  db: DbOrTx,
  clientServiceId: string,
  actor?: Actor,
  preloaded?: typeof services.$inferSelect,
): Promise<void> {
  const [cs] = await db
    .select()
    .from(clientServices)
    .where(eq(clientServices.id, clientServiceId))
    .limit(1);
  if (!cs) throw new AppError("NOT_FOUND");
  const service =
    preloaded ??
    (await db.select().from(services).where(eq(services.id, cs.serviceId)).limit(1))[0];
  await db
    .update(clientServices)
    .set({
      status: "active",
      startedAt: cs.startedAt ?? new Date(),
      pausedAt: null,
      pauseReason: null,
    })
    .where(eq(clientServices.id, cs.id));

  const setupTasks = [
    ...service.requiredInputs.map((input) => ({
      title: `Collect from client: ${input}`,
      status: "waiting_client" as const,
      visibility: "client" as const,
    })),
    ...service.requiredIntegrations.map((kind) => ({
      title: `Connect required integration: ${kind}`,
      status: "ready" as const,
      visibility: "internal" as const,
    })),
    ...service.includedActivities.slice(0, 4).map((activity) => ({
      title: `${service.name}: ${activity}`,
      status: "ready" as const,
      visibility: "client" as const,
    })),
  ];
  if (setupTasks.length) {
    await db.insert(tasks).values(
      setupTasks.map((t, i) => ({
        organisationId: cs.organisationId,
        clientServiceId: cs.id,
        title: t.title,
        status: t.status,
        visibility: t.visibility,
        source: "onboarding" as const,
        dueAt: new Date(Date.now() + (7 + i * 2) * 86400_000),
      })),
    );
  }
  await db.insert(timelineEntries).values({
    organisationId: cs.organisationId,
    kind: "milestone",
    title: `${service.name} started`,
    description: service.summary,
    visibility: "client",
  });

  if (cs.monthlyMinor > 0) {
    const [existing] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organisationId, cs.organisationId),
          inArray(subscriptions.status, ["active", "pending"]),
        ),
      )
      .limit(1);
    const payments = resolveIntegration("payments");
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (!existing) {
      await db.insert(subscriptions).values({
        organisationId: cs.organisationId,
        status: "active",
        provider: payments.available ? payments.adapter.provider : "manual",
        amountMinor: cs.monthlyMinor,
        currency: cs.currency,
        nextBillingDate: next.toISOString().slice(0, 10),
      });
    } else {
      await db
        .update(subscriptions)
        .set({ amountMinor: sql`${subscriptions.amountMinor} + ${cs.monthlyMinor}` })
        .where(eq(subscriptions.id, existing.id));
    }
  }
  await emitEvent(db, "service.activated", cs.organisationId, {
    clientServiceId: cs.id,
    service: service.slug,
  });
  if (actor)
    await logActivity(db, actor, {
      organisationId: cs.organisationId,
      action: "service.activated",
      summary: `${service.name} activated`,
      entityType: "client_service",
      entityId: cs.id,
    });
}

/**
 * Deactivates a service: stops open work for it, preserves history, updates billing
 * (the next monthly invoice simply excludes it) and the client portal.
 */
export async function deactivateClientService(
  db: DbOrTx,
  clientServiceId: string,
  actor: Actor,
  reason?: string,
): Promise<void> {
  const [cs] = await db
    .select()
    .from(clientServices)
    .where(eq(clientServices.id, clientServiceId))
    .limit(1);
  if (!cs) throw new AppError("NOT_FOUND");
  const [service] = await db.select().from(services).where(eq(services.id, cs.serviceId));
  await db
    .update(clientServices)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(clientServices.id, cs.id));
  await db
    .update(tasks)
    .set({ status: "cancelled" })
    .where(and(eq(tasks.clientServiceId, cs.id), inArray(tasks.status, OPEN_TASK_STATUSES)));
  if (cs.monthlyMinor > 0) {
    await db
      .update(subscriptions)
      .set({ amountMinor: sql`greatest(${subscriptions.amountMinor} - ${cs.monthlyMinor}, 0)` })
      .where(eq(subscriptions.organisationId, cs.organisationId));
  }
  await refreshMonthlyValue(db, cs.organisationId);
  await db.insert(timelineEntries).values({
    organisationId: cs.organisationId,
    kind: "milestone",
    title: `${service?.name ?? "Service"} ended`,
    description: reason,
    visibility: "client",
  });
  await emitEvent(db, "service.deactivated", cs.organisationId, { clientServiceId: cs.id });
  await logActivity(db, actor, {
    organisationId: cs.organisationId,
    action: "service.deactivated",
    summary: `${service?.name} deactivated`,
    entityType: "client_service",
    entityId: cs.id,
    reason,
  });
}

export async function setServicePaused(
  db: DbOrTx,
  clientServiceId: string,
  paused: boolean,
  actor: Actor,
): Promise<void> {
  const [cs] = await db
    .select()
    .from(clientServices)
    .where(eq(clientServices.id, clientServiceId))
    .limit(1);
  if (!cs) throw new AppError("NOT_FOUND");
  await db
    .update(clientServices)
    .set(
      paused
        ? { status: "paused", pausedAt: new Date(), pauseReason: "admin" }
        : { status: "active", pausedAt: null, pauseReason: null },
    )
    .where(eq(clientServices.id, cs.id));
  await emitEvent(db, paused ? "service.paused" : "service.resumed", cs.organisationId, {
    clientServiceId,
  });
  await logActivity(db, actor, {
    organisationId: cs.organisationId,
    action: paused ? "service.paused" : "service.resumed",
    summary: `Service ${paused ? "paused" : "resumed"}`,
    entityType: "client_service",
    entityId: cs.id,
  });
}
