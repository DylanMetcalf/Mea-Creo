import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { PayButton } from "@/components/billing/pay-button";
import { Callout, Card, CardHeader } from "@/components/ui/primitives";
import { DueLabel, StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { fmtDate, fmtMoney } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { eftLines, getBankDetails } from "@/modules/banking/service";
import { portalPayAction } from "../actions";

export const metadata: Metadata = { title: "Billing" };

export default async function PortalBilling({ searchParams }: PageProps<"/portal/billing">) {
  const ctx = await requireClient("portal.billing");
  const sp = await searchParams;
  const db = await getDb();
  const [rows, bank] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(eq(invoices.organisationId, ctx.organisationId))
      .orderBy(desc(invoices.issuedAt)),
    getBankDetails(db),
  ]);
  const visible = rows.filter((i) => i.status !== "draft");
  const due = visible.filter((i) => i.status === "open" || i.status === "overdue");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Billing</h1>
        <p className="text-muted mt-1">Invoices and payments. Pay securely online or by EFT.</p>
      </header>
      {sp.payment === "return" && (
        <Callout tone="success" title="Thank you">
          Your payment is being confirmed. This page updates once it&apos;s received.
        </Callout>
      )}
      {sp.payment === "failed" && (
        <Callout tone="danger" title="The payment didn't go through">
          No money was taken. Please try again.
        </Callout>
      )}
      {sp.payment === "cancelled" && <Callout tone="neutral">Payment cancelled.</Callout>}
      {due.length > 0 && (
        <Card>
          <CardHeader title="To pay" />
          <ul className="divide-border divide-y">
            {due.map((i) => (
              <li
                key={i.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block font-medium">
                    {i.number} · {fmtMoney(i.totalMinor - i.amountPaidMinor, i.currency)}
                  </span>
                  <span className="text-muted mt-1 flex items-center gap-2 text-xs">
                    <DueLabel due={i.dueAt} /> <StatusBadge kind="invoice" value={i.status} />
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <a
                    href={`/api/invoices/${i.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="border-border hover:bg-surface-2 rounded-md border px-3 py-2 text-sm"
                  >
                    Invoice PDF
                  </a>
                  <PayButton action={portalPayAction} label="Pay online">
                    <input type="hidden" name="invoiceId" value={i.id} />
                  </PayButton>
                </span>
              </li>
            ))}
          </ul>
          {bank && (
            <div className="border-border border-t px-5 py-4 text-sm">
              <p className="font-medium">Paying by EFT?</p>
              <ul className="text-ink-soft mt-1 space-y-0.5">
                {eftLines(bank, "your invoice number").map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="text-muted mt-1 text-xs">
                EFT payments are marked paid once they clear.
              </p>
            </div>
          )}
        </Card>
      )}
      <Card>
        <CardHeader title="All invoices" />
        <ul className="divide-border divide-y">
          {visible.length === 0 && (
            <li className="text-muted px-5 py-4 text-sm">No invoices yet.</li>
          )}
          {visible.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>
                {i.number}
                <span className="text-muted block text-xs">
                  Issued {fmtDate(i.issuedAt)}
                  {i.paidAt ? ` · paid ${fmtDate(i.paidAt)}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{fmtMoney(i.totalMinor, i.currency)}</span>
                <StatusBadge kind="invoice" value={i.status} />
                <a
                  href={`/api/invoices/${i.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:bg-surface-2 rounded-md p-1.5"
                  aria-label={`Download ${i.number}`}
                >
                  <Download className="size-4" aria-hidden />
                </a>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
