import type { Money } from "@/lib/money";
import type { IntegrationAdapter } from "../types";

/** Accounting sync (Xero first). External ids are stored as references, never as primary keys. */

export interface AccountingContact {
  externalId?: string;
  name: string;
  email?: string;
  taxNumber?: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitAmount: Money;
  accountCode?: string;
  taxType?: string;
}

export interface InvoiceDraft {
  contactExternalId: string;
  reference: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
}

export type AccountingInvoiceStatus = "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";

export interface AccountingInvoice {
  externalId: string;
  number?: string;
  status: AccountingInvoiceStatus;
  total: Money;
  amountDue: Money;
}

export interface AccountingProvider extends IntegrationAdapter {
  readonly kind: "accounting";
  upsertContact(contact: AccountingContact): Promise<{ externalId: string }>;
  createInvoice(invoice: InvoiceDraft): Promise<AccountingInvoice>;
  getInvoice(externalId: string): Promise<AccountingInvoice | null>;
  recordPayment(input: {
    invoiceExternalId: string;
    amount: Money;
    date: string;
    reference: string;
  }): Promise<{ externalId: string }>;
}
