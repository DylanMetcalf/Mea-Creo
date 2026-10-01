import { asc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { clients, invoiceLines, invoices } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { generatePdf, type PdfBlock } from "@/lib/pdf";
import { formatProposalMoney } from "@/modules/proposals/service";
import { eftLines, getBankDetails } from "@/modules/banking/service";
import { getPlatformSetting } from "@/modules/settings/service";

/** Invoice PDF. Callers check access first. Company and bank details come only from settings. */
export async function invoicePdf(db: DbOrTx, id: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) return null;
  const [lines, [client], company, billing, bank] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.id)),
    db.select().from(clients).where(eq(clients.organisationId, invoice.organisationId)),
    getPlatformSetting(db, "company"),
    getPlatformSetting(db, "billing"),
    getBankDetails(db),
  ]);
  const m = (minor: number) => formatProposalMoney(minor, invoice.currency);
  const blocks: PdfBlock[] = [
    { type: "title", text: billing.vatRegistered ? "Tax invoice" : "Invoice" },
    {
      type: "subtitle",
      text: `${invoice.number} · issued ${fmtDate(invoice.issuedAt)} · due ${fmtDate(invoice.dueAt)}`,
    },
    {
      type: "kv",
      rows: [
        [
          "From",
          [
            company.legalName,
            company.registrationNumber && `Reg. ${company.registrationNumber}`,
            company.vatNumber && `VAT ${company.vatNumber}`,
            [company.streetAddress, company.locality, company.region, company.postalCode]
              .filter(Boolean)
              .join(", "),
            company.email,
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        ["To", [client?.name, client?.email].filter(Boolean).join(" · ")],
      ],
    },
    { type: "rule" },
    {
      type: "table",
      headers: ["Description", "Qty", "Unit", "Amount"],
      widths: [0.55, 0.1, 0.17, 0.18],
      alignRight: [1, 2, 3],
      rows: lines.map((l) => [l.description, String(l.quantity), m(l.unitMinor), m(l.amountMinor)]),
    },
    {
      type: "kv",
      rows: [
        ["Subtotal", m(invoice.subtotalMinor)],
        [
          billing.vatRegistered ? `VAT (${invoice.taxRateBps / 100}%)` : "VAT",
          billing.vatRegistered ? m(invoice.taxMinor) : "Not VAT registered",
        ],
        ["Total", m(invoice.totalMinor)],
        ["Paid", m(invoice.amountPaidMinor)],
        ["Balance due", m(invoice.totalMinor - invoice.amountPaidMinor)],
      ],
    },
  ];
  if (invoice.status === "paid")
    blocks.push({ type: "p", text: `Paid in full on ${fmtDate(invoice.paidAt)}. Thank you.` });
  else {
    blocks.push(
      { type: "h2", text: "How to pay" },
      { type: "p", text: "Pay online from your Mea Creo client portal (Billing)." },
    );
    blocks.push({
      type: "p",
      text: bank
        ? `Or by EFT:\n${eftLines(bank, invoice.number).join("\n")}`
        : "EFT details are available on request.",
    });
  }
  return {
    filename: `${invoice.number}.pdf`,
    organisationId: invoice.organisationId,
    status: invoice.status,
    body: generatePdf({
      title: `Invoice ${invoice.number}`,
      blocks,
      footer: `${company.legalName} · ${company.email}`,
    }),
  };
}
