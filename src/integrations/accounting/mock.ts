import { money } from "@/lib/money";
import { health } from "../types";
import type {
  AccountingContact,
  AccountingInvoice,
  AccountingProvider,
  InvoiceDraft,
} from "./types";

export class MockAccountingProvider implements AccountingProvider {
  readonly kind = "accounting" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly contacts = new Map<string, AccountingContact>();
  readonly invoices = new Map<string, AccountingInvoice>();
  private seq = 0;

  async healthCheck() {
    return health(this, "CONNECTED", "Mock accounting. Nothing is sent to Xero.");
  }

  async upsertContact(contact: AccountingContact) {
    const externalId = contact.externalId ?? `mock-contact-${++this.seq}`;
    this.contacts.set(externalId, { ...contact, externalId });
    return { externalId };
  }

  async createInvoice(draft: InvoiceDraft): Promise<AccountingInvoice> {
    if (!this.contacts.has(draft.contactExternalId)) {
      throw new Error(`Unknown mock contact ${draft.contactExternalId}`);
    }
    const currency = draft.lines[0]?.unitAmount.currency ?? "ZAR";
    const totalMinor = draft.lines.reduce(
      (sum, line) => sum + Math.round(line.unitAmount.amountMinor * line.quantity),
      0,
    );
    const invoice: AccountingInvoice = {
      externalId: `mock-invoice-${++this.seq}`,
      number: `MOCK-${String(this.seq).padStart(4, "0")}`,
      status: "AUTHORISED",
      total: money(totalMinor, currency),
      amountDue: money(totalMinor, currency),
    };
    this.invoices.set(invoice.externalId, invoice);
    return invoice;
  }

  async getInvoice(externalId: string) {
    return this.invoices.get(externalId) ?? null;
  }

  async recordPayment(input: Parameters<AccountingProvider["recordPayment"]>[0]) {
    const invoice = this.invoices.get(input.invoiceExternalId);
    if (!invoice) throw new Error(`Unknown mock invoice ${input.invoiceExternalId}`);
    const due = Math.max(0, invoice.amountDue.amountMinor - input.amount.amountMinor);
    this.invoices.set(invoice.externalId, {
      ...invoice,
      amountDue: money(due, invoice.total.currency),
      status: due === 0 ? "PAID" : invoice.status,
    });
    return { externalId: `mock-payment-${++this.seq}` };
  }
}
