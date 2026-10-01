"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { fromMajor, isCurrency, money } from "@/lib/money";
import { logActivity, userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import {
  applyPaymentEvent,
  createInvoice,
  runDailyBilling,
  syncInvoiceToAccounting,
} from "@/modules/billing/service";

const invoiceSchema = z.object({
  organisationId: z.uuid("Choose a client."),
  kind: z.enum(["setup", "monthly", "once_off", "adjustment"]),
  currency: z.string().refine(isCurrency, "Unsupported currency."),
  description: optionalText(300),
  dueInDays: z.coerce.number().int().min(0).max(90),
  issue: z.string().optional(),
});

export async function createInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("billing.manage");
    const parsed = parseForm(invoiceSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    await assertStaffClientAccess(ctx, d.organisationId);
    const lines = [0, 1, 2, 3, 4]
      .map((i) => ({
        description: String(formData.get(`line.${i}.description`) ?? "")
          .trim()
          .slice(0, 200),
        quantity: Math.max(1, Number(formData.get(`line.${i}.quantity`) || 1)),
        amount: String(formData.get(`line.${i}.amount`) ?? "").replace(/[^\d.]/g, ""),
      }))
      .filter((l) => l.description && l.amount)
      .map((l) => ({
        description: l.description,
        quantity: Math.floor(l.quantity),
        unitMinor: fromMajor(l.amount, d.currency as never).amountMinor,
      }));
    if (!lines.length)
      return { ok: false, message: "Add at least one line with a description and amount." };
    const db = await getDb();
    const invoice = await createInvoice(db, {
      organisationId: d.organisationId,
      kind: d.kind,
      currency: d.currency,
      description: d.description,
      dueInDays: d.dueInDays,
      lines,
      issue: d.issue === "on",
    });
    await logActivity(db, userActor(ctx.user), {
      organisationId: d.organisationId,
      action: "invoice.created",
      summary: `Created invoice ${invoice.number}`,
      entityType: "invoice",
      entityId: invoice.id,
    });
    id = invoice.id;
  }, formData);
  if (id) redirect(`/workspace/billing/${id}`);
  return state;
}

/** Records an EFT/manual payment through the same path as provider payments. */
export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("billing.manage");
    const db = await getDb();
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, String(formData.get("invoiceId"))));
    if (!invoice) throw new AppError("NOT_FOUND");
    await assertStaffClientAccess(ctx, invoice.organisationId);
    const currency = isCurrency(invoice.currency) ? invoice.currency : "ZAR";
    const raw = String(formData.get("amount") ?? "").replace(/[^\d.]/g, "");
    const amountMinor = raw
      ? fromMajor(raw, currency).amountMinor
      : invoice.totalMinor - invoice.amountPaidMinor;
    if (amountMinor <= 0)
      return { ok: false, fieldErrors: { amount: ["Enter the amount received."] } };
    const reference = String(formData.get("reference") ?? "")
      .trim()
      .slice(0, 100);
    await applyPaymentEvent(db, "manual", {
      type: "payment.completed",
      reference: invoice.id,
      providerPaymentId: `manual-${randomToken(10)}`,
      amount: money(amountMinor, currency),
      occurredAt: new Date(),
      raw: { method: "eft", reference, recordedBy: ctx.user.email },
    });
    await logActivity(db, userActor(ctx.user), {
      organisationId: invoice.organisationId,
      action: "payment.recorded",
      summary: `Recorded EFT payment on ${invoice.number}${reference ? ` (ref ${reference})` : ""}`,
      entityType: "invoice",
      entityId: invoice.id,
    });
    refresh();
    return { ok: true, message: "Payment recorded." };
  }, formData);
}

export async function voidInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("billing.manage");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3)
      return { ok: false, fieldErrors: { reason: ["Give a reason for the record."] } };
    const db = await getDb();
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, String(formData.get("invoiceId"))));
    if (!invoice) throw new AppError("NOT_FOUND");
    await assertStaffClientAccess(ctx, invoice.organisationId);
    if (invoice.amountPaidMinor > 0)
      return {
        ok: false,
        message: "This invoice has payments. Issue a credit adjustment instead.",
      };
    await db.update(invoices).set({ status: "void" }).where(eq(invoices.id, invoice.id));
    await logActivity(db, userActor(ctx.user), {
      organisationId: invoice.organisationId,
      action: "invoice.voided",
      summary: `Voided ${invoice.number}`,
      reason,
      entityType: "invoice",
      entityId: invoice.id,
      before: { status: invoice.status },
      after: { status: "void" },
    });
    refresh();
    return { ok: true, message: "Invoice voided." };
  }, formData);
}

export async function issueInvoiceAction(invoiceId: string): Promise<void> {
  const ctx = await requireStaff("billing.manage");
  const db = await getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice || invoice.status !== "draft") throw new AppError("NOT_FOUND");
  await assertStaffClientAccess(ctx, invoice.organisationId);
  await db
    .update(invoices)
    .set({
      status: "open",
      issuedAt: new Date(),
      dueAt: invoice.dueAt ?? new Date(Date.now() + 7 * 86400_000),
    })
    .where(eq(invoices.id, invoiceId));
  await syncInvoiceToAccounting(db, invoiceId);
  refresh();
}

export async function syncInvoiceAction(invoiceId: string): Promise<void> {
  await requireStaff("billing.manage");
  await syncInvoiceToAccounting(await getDb(), invoiceId);
  refresh();
}

export async function runDailyBillingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("billing.manage");
    const db = await getDb();
    const result = await runDailyBilling(db);
    await logActivity(db, userActor(ctx.user), {
      action: "billing.daily_run",
      summary: `Ran the billing cycle: ${result.issued} issued, ${result.overdue} overdue, ${result.paused} paused`,
    });
    kickJobs();
    refresh();
    return {
      ok: true,
      message: `Billing cycle done: ${result.issued} invoices issued, ${result.overdue} marked overdue, ${result.paused} clients paused.`,
    };
  }, formData);
}
