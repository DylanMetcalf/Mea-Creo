import { and, desc, eq, inArray, like, lte, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import {
  clients,
  clientServices,
  type InvoiceStatus,
  invoiceLines,
  invoices,
  memberships,
  organisations,
  payments,
  subscriptions,
  timelineEntries,
  users,
} from "@/db/schema";
import type {
  CheckoutRedirect,
  IncomingWebhook,
  PaymentWebhookEvent,
} from "@/integrations/payments/types";
import { resolveIntegration } from "@/integrations/registry";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { formatMoney, money, isCurrency } from "@/lib/money";
import { absoluteUrl } from "@/lib/urls";
import { logActivity } from "@/modules/activity/log";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { emitEvent, notifyClient, notifyStaff } from "@/modules/notifications/service";
import { getPlatformSetting } from "@/modules/settings/service";

export async function nextInvoiceNumber(db: DbOrTx): Promise<string> {
  const billing = await getPlatformSetting(db, "billing");
  const year = new Date().getFullYear();
  const prefix = `${billing.invoicePrefix}-${year}-`;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(like(invoices.number, `${prefix}%`));
  let seq = (row?.n ?? 0) + 1;
  // Guard against gaps/collisions (e.g. demo data).
  for (;;) {
    const candidate = `${prefix}${String(seq).padStart(4, "0")}`;
    const [exists] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.number, candidate))
      .limit(1);
    if (!exists) return candidate;
    seq++;
  }
}

export interface InvoiceLineInput {
  description: string;
  quantity?: number;
  unitMinor: number;
  clientServiceId?: string;
}

/** Creates and issues an invoice. Tax uses the configured rate (0 until VAT registration is confirmed). */
export async function createInvoice(
  db: DbOrTx,
  input: {
    organisationId: string;
    kind: "setup" | "monthly" | "once_off" | "adjustment";
    currency: string;
    lines: InvoiceLineInput[];
    description?: string;
    proposalId?: string;
    dueInDays?: number;
    issue?: boolean;
  },
): Promise<typeof invoices.$inferSelect> {
  if (input.lines.length === 0)
    throw new AppError("VALIDATION", { userMessage: "An invoice needs at least one line." });
  const billing = await getPlatformSetting(db, "billing");
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitMinor * (l.quantity ?? 1), 0);
  const taxRateBps = billing.vatRegistered ? Math.round(billing.taxRatePercent * 100) : 0;
  const tax = Math.round((subtotal * taxRateBps) / 10_000);
  const issued = input.issue ?? true;
  const [invoice] = await db
    .insert(invoices)
    .values({
      organisationId: input.organisationId,
      number: await nextInvoiceNumber(db),
      kind: input.kind,
      status: issued ? "open" : "draft",
      currency: input.currency,
      subtotalMinor: subtotal,
      taxMinor: tax,
      taxRateBps,
      totalMinor: subtotal + tax,
      description: input.description,
      proposalId: input.proposalId,
      issuedAt: issued ? new Date() : null,
      dueAt: issued
        ? new Date(Date.now() + (input.dueInDays ?? billing.paymentTermsDays) * 86400_000)
        : null,
      periodStart: new Date().toISOString().slice(0, 10),
    })
    .returning();
  await db
    .insert(invoiceLines)
    .values(
      input.lines.map((l) => ({
        invoiceId: invoice.id,
        description: l.description,
        quantity: l.quantity ?? 1,
        unitMinor: l.unitMinor,
        amountMinor: l.unitMinor * (l.quantity ?? 1),
        clientServiceId: l.clientServiceId,
      })),
    );
  if (issued) await syncInvoiceToAccounting(db, invoice.id);
  return invoice;
}

/** Pushes an invoice to the accounting system (Xero) when connected. Failures are recorded, not thrown. */
export async function syncInvoiceToAccounting(db: DbOrTx, invoiceId: string): Promise<void> {
  const accounting = resolveIntegration("accounting");
  if (!accounting.available) return;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, invoice.organisationId));
  if (!invoice || !client) return;
  try {
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
    const currency = isCurrency(invoice.currency) ? invoice.currency : "ZAR";
    const { externalId: contactId } = await accounting.adapter.upsertContact({
      name: client.name,
      email: client.email ?? undefined,
    });
    const result = await accounting.adapter.createInvoice({
      contactExternalId: contactId,
      reference: invoice.number,
      issueDate: (invoice.issuedAt ?? new Date()).toISOString().slice(0, 10),
      dueDate: (invoice.dueAt ?? new Date()).toISOString().slice(0, 10),
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitAmount: money(l.unitMinor, currency),
      })),
    });
    await db
      .update(invoices)
      .set({
        externalId: result.externalId,
        externalProvider: accounting.adapter.provider,
        syncStatus: "synced",
        syncError: null,
      })
      .where(eq(invoices.id, invoiceId));
  } catch (error) {
    await db
      .update(invoices)
      .set({
        syncStatus: "error",
        syncError: error instanceof Error ? error.message : String(error),
      })
      .where(eq(invoices.id, invoiceId));
  }
}

async function billingContacts(db: DbOrTx, organisationId: string) {
  return db
    .select({ email: users.email, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(eq(memberships.organisationId, organisationId), eq(memberships.role, "client_admin")),
    );
}

/** Starts a hosted checkout for an open invoice. The organisation must own the invoice. */
export async function startCheckout(
  db: DbOrTx,
  input: { organisationId: string; invoiceId: string; customer: { email: string; name: string } },
): Promise<CheckoutRedirect> {
  const emergency = await getPlatformSetting(db, "emergency");
  if (emergency.pausePayments)
    throw new AppError("INTEGRATION_NOT_CONNECTED", {
      userMessage:
        "Online payments are temporarily unavailable. Please try again later or contact us.",
    });
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organisationId, input.organisationId)))
    .limit(1);
  if (!invoice) throw new AppError("NOT_FOUND");
  if (invoice.status !== "open" && invoice.status !== "overdue")
    throw new AppError("CONFLICT", { userMessage: "This invoice doesn't need payment." });
  const payments = resolveIntegration("payments");
  if (!payments.available)
    throw new AppError("INTEGRATION_NOT_CONNECTED", {
      userMessage:
        "Online payment isn't set up yet. Please pay by EFT using the details on your invoice.",
    });
  const currency = isCurrency(invoice.currency) ? invoice.currency : "ZAR";
  return payments.adapter.createOnceOffPayment({
    reference: invoice.id,
    amount: money(invoice.totalMinor - invoice.amountPaidMinor, currency),
    description: `Mea Creo invoice ${invoice.number}`,
    customer: input.customer,
    returnUrl: absoluteUrl(`/portal/billing?payment=return&invoice=${invoice.id}`),
    cancelUrl: absoluteUrl(`/portal/billing?payment=cancelled&invoice=${invoice.id}`),
    notifyUrl: absoluteUrl(`/api/webhooks/payments/${payments.adapter.provider}`),
  });
}

/** Verifies a provider notification and applies it. Idempotent. */
export async function handlePaymentWebhook(
  db: Db,
  provider: string,
  webhook: IncomingWebhook,
): Promise<{ ok: boolean; reason?: string }> {
  const payments = resolveIntegration("payments");
  if (!payments.available || payments.adapter.provider !== provider)
    return { ok: false, reason: "Provider not active" };
  const verification = await payments.adapter.verifyWebhook(webhook);
  if (!verification.valid) {
    logger.warn({ provider, reason: verification.reason }, "payment webhook rejected");
    await logActivity(
      db,
      { type: "webhook", label: provider },
      {
        action: "payment.webhook_rejected",
        summary: `Rejected ${provider} notification: ${verification.reason}`,
      },
    );
    return { ok: false, reason: verification.reason };
  }
  await applyPaymentEvent(db, provider, verification.event);
  return { ok: true };
}

export async function applyPaymentEvent(
  db: Db,
  provider: string,
  event: PaymentWebhookEvent,
): Promise<void> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, event.reference))
    .limit(1);
  if (!invoice) {
    logger.warn({ reference: event.reference }, "payment for unknown invoice");
    return;
  }
  const status =
    event.type === "payment.completed"
      ? "succeeded"
      : event.type === "payment.cancelled"
        ? "cancelled"
        : "failed";
  const inserted = await db
    .insert(payments)
    .values({
      organisationId: invoice.organisationId,
      invoiceId: invoice.id,
      provider,
      providerPaymentId: event.providerPaymentId,
      status,
      amountMinor: event.amount.amountMinor,
      currency: event.amount.currency,
      raw: event.raw,
    })
    .onConflictDoNothing({ target: [payments.provider, payments.providerPaymentId] })
    .returning({ id: payments.id });
  if (inserted.length === 0) return; // Already processed.

  const contacts = await billingContacts(db, invoice.organisationId);
  if (status !== "succeeded") {
    await emitEvent(db, "payment.failed", invoice.organisationId, { invoiceId: invoice.id });
    await notifyStaff(db, {
      kind: "payment.failed",
      title: `Payment failed: invoice ${invoice.number}`,
      link: `/workspace/billing`,
      organisationId: invoice.organisationId,
    });
    for (const c of contacts) {
      await sendEmail(db, {
        to: c,
        template: "paymentFailed",
        category: "transactional",
        organisationId: invoice.organisationId,
        email: emailTemplates.paymentFailed({
          name: c.name,
          invoice: invoice.number,
          url: absoluteUrl("/portal/billing"),
        }),
        idempotencyKey: `payfail:${event.providerPaymentId}:${c.email}`,
      });
    }
    return;
  }

  // Amount check (Payfast ITN step 4): underpayments are recorded but don't settle the invoice.
  const outstanding = invoice.totalMinor - invoice.amountPaidMinor;
  const paidMinor = invoice.amountPaidMinor + event.amount.amountMinor;
  const settled = event.amount.amountMinor >= outstanding;
  await db
    .update(invoices)
    .set({
      amountPaidMinor: paidMinor,
      status: settled ? "paid" : invoice.status,
      paidAt: settled ? new Date() : null,
    })
    .where(eq(invoices.id, invoice.id));
  if (event.subscriptionToken) {
    await db
      .update(subscriptions)
      .set({ providerToken: event.subscriptionToken, status: "active" })
      .where(eq(subscriptions.organisationId, invoice.organisationId));
  }
  await logActivity(
    db,
    { type: "webhook", label: provider },
    {
      organisationId: invoice.organisationId,
      action: "payment.received",
      summary: `Payment of ${formatMoney(event.amount)} received for ${invoice.number}${settled ? "" : " (partial)"}`,
      entityType: "invoice",
      entityId: invoice.id,
    },
  );
  await db
    .insert(timelineEntries)
    .values({
      organisationId: invoice.organisationId,
      kind: "billing",
      title: `Payment received: ${invoice.number}`,
      visibility: "client",
    });
  await emitEvent(db, "payment.completed", invoice.organisationId, {
    invoiceId: invoice.id,
    kind: invoice.kind,
  });
  await notifyStaff(db, {
    kind: "payment.completed",
    title: `Payment received: ${invoice.number}`,
    body: formatMoney(event.amount),
    link: `/workspace/billing`,
    organisationId: invoice.organisationId,
  });
  for (const c of contacts) {
    await sendEmail(db, {
      to: c,
      template: "paymentReceived",
      category: "transactional",
      organisationId: invoice.organisationId,
      email: emailTemplates.paymentReceived({
        name: c.name,
        amount: formatMoney(event.amount),
        invoice: invoice.number,
        url: absoluteUrl("/portal/billing"),
      }),
      idempotencyKey: `paid:${event.providerPaymentId}:${c.email}`,
    });
  }
  if (settled) await afterInvoicePaid(db, invoice.organisationId, invoice.kind);
}

/** When nothing is overdue any more: restore billing-paused services and activate pending ones. */
export async function afterInvoicePaid(
  db: DbOrTx,
  organisationId: string,
  kind: string,
): Promise<void> {
  const [stillOverdue] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.organisationId, organisationId), eq(invoices.status, "overdue")))
    .limit(1);
  if (stillOverdue) return;
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!client) return;

  const paused = await db
    .select()
    .from(clientServices)
    .where(
      and(
        eq(clientServices.organisationId, organisationId),
        eq(clientServices.status, "paused"),
        eq(clientServices.pauseReason, "billing"),
      ),
    );
  if (paused.length) {
    await db
      .update(clientServices)
      .set({ status: "active", pausedAt: null, pauseReason: null })
      .where(
        inArray(
          clientServices.id,
          paused.map((p) => p.id),
        ),
      );
    await db
      .insert(timelineEntries)
      .values({
        organisationId,
        kind: "billing",
        title: "Services resumed",
        description: "Payment confirmed; paused work has resumed.",
        visibility: "client",
      });
    for (const c of await billingContacts(db, organisationId)) {
      await sendEmail(db, {
        to: c,
        template: "serviceResumed",
        category: "transactional",
        organisationId,
        email: emailTemplates.serviceResumed({ name: c.name, url: absoluteUrl("/portal") }),
      });
    }
    await emitEvent(db, "service.resumed", organisationId, { count: paused.length });
  }
  if (kind === "setup" || client.billingState === "pending_payment") {
    const { activatePendingServices } = await import("@/modules/services/activation");
    await activatePendingServices(db, organisationId);
  }
  await db
    .update(clients)
    .set({ billingState: "active" })
    .where(eq(clients.organisationId, organisationId));
  const { recomputeHealth } = await import("@/modules/clients/health");
  await recomputeHealth(db, organisationId);
}

/**
 * Daily billing cycle: generate due monthly invoices, mark overdue, send reminders,
 * and pause automated services after the configured grace period. Never deletes data.
 */
export async function runDailyBilling(
  db: Db,
  now = new Date(),
): Promise<{ issued: number; overdue: number; paused: number }> {
  const billing = await getPlatformSetting(db, "billing");
  let issued = 0;
  let overdueCount = 0;
  let pausedCount = 0;

  // 1. Monthly invoices for active subscriptions that are due.
  const today = now.toISOString().slice(0, 10);
  const due = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), lte(subscriptions.nextBillingDate, today)));
  for (const sub of due) {
    const lines = await db
      .select()
      .from(clientServices)
      .where(
        and(
          eq(clientServices.organisationId, sub.organisationId),
          inArray(clientServices.status, ["active", "paused"]),
        ),
      );
    const billable = lines.filter((l) => l.monthlyMinor > 0);
    if (billable.length) {
      const { services } = await import("@/db/schema");
      const names = await db.select({ id: services.id, name: services.name }).from(services);
      await createInvoice(db, {
        organisationId: sub.organisationId,
        kind: "monthly",
        currency: sub.currency,
        lines: billable.map((l) => ({
          description: names.find((n) => n.id === l.serviceId)?.name ?? "Service",
          unitMinor: l.monthlyMinor,
          clientServiceId: l.id,
        })),
        description: `Monthly services: ${now.toLocaleString("en-ZA", { month: "long", year: "numeric" })}`,
      });
      issued++;
    }
    const next = new Date(`${sub.nextBillingDate}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    await db
      .update(subscriptions)
      .set({ nextBillingDate: next.toISOString().slice(0, 10) })
      .where(eq(subscriptions.id, sub.id));
  }

  // 2. Overdue + reminders + pausing.
  const open = await db
    .select()
    .from(invoices)
    .where(inArray(invoices.status, ["open", "overdue"] as InvoiceStatus[]));
  for (const invoice of open) {
    if (!invoice.dueAt || invoice.dueAt > now) continue;
    const daysOverdue = Math.floor((now.getTime() - invoice.dueAt.getTime()) / 86400_000);
    const contacts = await billingContacts(db, invoice.organisationId);
    const amount = formatMoney(
      money(
        invoice.totalMinor - invoice.amountPaidMinor,
        isCurrency(invoice.currency) ? invoice.currency : "ZAR",
      ),
    );

    if (invoice.status === "open") {
      await db.update(invoices).set({ status: "overdue" }).where(eq(invoices.id, invoice.id));
      await db
        .update(clients)
        .set({ billingState: "overdue" })
        .where(eq(clients.organisationId, invoice.organisationId));
      await emitEvent(db, "invoice.overdue", invoice.organisationId, { invoiceId: invoice.id });
      await notifyStaff(db, {
        kind: "invoice.overdue",
        title: `Invoice overdue: ${invoice.number}`,
        body: amount,
        link: "/workspace/billing",
        organisationId: invoice.organisationId,
      });
      overdueCount++;
    }
    const reminderDue = billing.reminderDaysAfterDue[invoice.remindersSent];
    if (reminderDue !== undefined && daysOverdue >= reminderDue) {
      for (const c of contacts) {
        await sendEmail(db, {
          to: c,
          template: "invoiceOverdue",
          category: "transactional",
          organisationId: invoice.organisationId,
          email: emailTemplates.invoiceOverdue({
            name: c.name,
            invoice: invoice.number,
            amount,
            url: absoluteUrl("/portal/billing"),
          }),
          idempotencyKey: `overdue:${invoice.id}:${invoice.remindersSent}:${c.email}`,
        });
      }
      await db
        .update(invoices)
        .set({ remindersSent: invoice.remindersSent + 1 })
        .where(eq(invoices.id, invoice.id));
    }
    if (daysOverdue >= billing.pauseAfterOverdueDays) {
      pausedCount += await pauseForBilling(db, invoice.organisationId);
    }
  }
  return { issued, overdue: overdueCount, paused: pausedCount };
}

/** Pauses automated services for an overdue account. Portal access, reports and documents remain. */
export async function pauseForBilling(db: DbOrTx, organisationId: string): Promise<number> {
  const { services } = await import("@/db/schema");
  const active = await db
    .select({ id: clientServices.id, automation: services.automationLevel })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(eq(clientServices.organisationId, organisationId), eq(clientServices.status, "active")),
    );
  const toPause = active.filter((s) => s.automation !== "manual").map((s) => s.id);
  if (toPause.length === 0) return 0;
  await db
    .update(clientServices)
    .set({ status: "paused", pausedAt: new Date(), pauseReason: "billing" })
    .where(inArray(clientServices.id, toPause));
  await db
    .insert(timelineEntries)
    .values({
      organisationId,
      kind: "billing",
      title: "Automated work paused",
      description:
        "An invoice is overdue. Reports, documents and billing remain available, and work resumes when payment is received.",
      visibility: "client",
    });
  await emitEvent(db, "service.paused", organisationId, {
    reason: "billing",
    count: toPause.length,
  });
  await notifyClient(db, organisationId, {
    kind: "service.paused",
    title: "Some services are paused",
    body: "An invoice is overdue. Nothing has been deleted.",
    link: "/portal/billing",
  });
  for (const c of await billingContacts(db, organisationId)) {
    await sendEmail(db, {
      to: c,
      template: "servicePaused",
      category: "transactional",
      organisationId,
      email: emailTemplates.servicePaused({ name: c.name, url: absoluteUrl("/portal/billing") }),
      idempotencyKey: `paused:${organisationId}:${new Date().toISOString().slice(0, 10)}:${c.email}`,
    });
  }
  return toPause.length;
}

export async function invoicesFor(db: DbOrTx, organisationId: string) {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.organisationId, organisationId))
    .orderBy(desc(invoices.issuedAt));
}

export async function organisationName(db: DbOrTx, organisationId: string): Promise<string> {
  const [org] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  return org?.name ?? "";
}
