import { asc, desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { invoiceLines, invoices, organisations, payments } from "@/db/schema";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import {
  issueInvoiceAction,
  recordPaymentAction,
  syncInvoiceAction,
  voidInvoiceAction,
} from "../actions";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/workspace/billing/[id]">) {
  const ctx = await requireStaff("billing.read");
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ i: invoices, org: organisations.name })
    .from(invoices)
    .innerJoin(organisations, eq(organisations.id, invoices.organisationId))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) notFound();
  const { i, org } = row;
  await assertStaffClientAccess(ctx, i.organisationId);
  const [lines, pays] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.id)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.receivedAt)),
  ]);
  const m = (minor: number) => fmtMoney(minor, i.currency);
  const balance = i.totalMinor - i.amountPaidMinor;
  const manage = ctx.can("billing.manage");

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/billing" className="hover:text-ink">
          Billing
        </Link>{" "}
        / {i.number}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Invoice {i.number}</h1>
            <StatusBadge kind="invoice" value={i.status} />
          </div>
          <p className="text-muted mt-1 text-sm">
            <Link
              href={`/workspace/clients/${i.organisationId}?tab=billing`}
              className="text-brand-700 hover:underline"
            >
              {org}
            </Link>{" "}
            · {statusLabel(i.kind)} · issued {fmtDate(i.issuedAt)} · due {fmtDate(i.dueAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/invoices/${i.id}/pdf`} variant="secondary" target="_blank">
            <Download className="size-4" aria-hidden /> PDF
          </LinkButton>
          {manage && i.status === "draft" && (
            <form action={issueInvoiceAction.bind(null, i.id)}>
              <SubmitButton>Issue invoice</SubmitButton>
            </form>
          )}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs">
                  <tr className="border-border border-b">
                    <th className="px-5 py-3 font-medium">Description</th>
                    <th className="px-3 py-3 text-right font-medium">Qty</th>
                    <th className="px-3 py-3 text-right font-medium">Unit</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-border border-b">
                      <td className="px-5 py-3">{l.description}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{m(l.unitMinor)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{m(l.amountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="flex justify-end">
              <DescriptionList
                items={[
                  ["Subtotal", m(i.subtotalMinor)],
                  [
                    `VAT${i.taxRateBps ? ` (${i.taxRateBps / 100}%)` : ""}`,
                    i.taxRateBps ? m(i.taxMinor) : "Not charged",
                  ],
                  ["Total", m(i.totalMinor)],
                  ["Paid", m(i.amountPaidMinor)],
                  ["Balance", m(balance)],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payments" />
            <ul className="divide-border divide-y">
              {pays.length === 0 && (
                <li className="text-muted px-5 py-4 text-sm">No payments recorded.</li>
              )}
              {pays.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span>
                    {m(p.amountMinor)} ·{" "}
                    {p.provider === "manual"
                      ? `EFT${p.raw.reference ? ` (ref ${p.raw.reference})` : ""}`
                      : p.provider}
                    <span className="text-muted block text-xs">{fmtDateTime(p.receivedAt)}</span>
                  </span>
                  <StatusBadge kind="payment" value={p.status} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          {manage && (i.status === "open" || i.status === "overdue") && (
            <Card>
              <CardHeader
                title="Record an EFT payment"
                description="Updates the invoice, reactivates paused services and notifies the client, exactly like an online payment."
              />
              <CardBody>
                <ActionForm action={recordPaymentAction} className="space-y-3">
                  <input type="hidden" name="invoiceId" value={i.id} />
                  <TextField
                    name="amount"
                    label="Amount received"
                    defaultValue={String(balance / 100)}
                    inputMode="decimal"
                  />
                  <TextField name="reference" label="Bank reference (optional)" />
                  <SubmitButton>Record payment</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Accounting" />
            <CardBody className="space-y-3 text-sm">
              <p>
                Xero sync: <span className="font-medium">{statusLabel(i.syncStatus)}</span>
                {i.externalId && <span className="text-muted"> · {i.externalId}</span>}
              </p>
              {manage && i.status !== "draft" && (
                <form action={syncInvoiceAction.bind(null, i.id)}>
                  <SubmitButton size="sm" variant="secondary">
                    Sync now
                  </SubmitButton>
                </form>
              )}
            </CardBody>
          </Card>
          {manage && i.status !== "void" && i.amountPaidMinor === 0 && (
            <Card>
              <CardHeader title="Void invoice" />
              <CardBody>
                <ActionForm action={voidInvoiceAction} className="space-y-3">
                  <input type="hidden" name="invoiceId" value={i.id} />
                  <TextField name="reason" label="Reason" required />
                  <SubmitButton size="sm" variant="ghost">
                    Void
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
