import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, moneyMinor, timestamps } from "./_common";
import { organisations } from "./identity";
import { proposals } from "./sales";

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "paused",
  "cancelled",
  "failed",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull().default("pending"),
    provider: text("provider").notNull(),
    /** Provider's recurring-billing token. Never card data. */
    providerToken: text("provider_token"),
    amountMinor: moneyMinor("amount_minor").notNull(),
    currency: currency(),
    frequency: text("frequency", { enum: ["monthly", "quarterly", "biannual", "annual"] })
      .notNull()
      .default("monthly"),
    nextBillingDate: date("next_billing_date"),
    ...timestamps(),
  },
  (t) => [index("subscriptions_org_idx").on(t.organisationId)],
);

export const INVOICE_STATUSES = ["draft", "open", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_KINDS = ["setup", "monthly", "once_off", "adjustment"] as const;

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    number: text("number").notNull().unique(),
    kind: text("kind", { enum: INVOICE_KINDS }).notNull().default("monthly"),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("draft"),
    currency: currency(),
    subtotalMinor: moneyMinor("subtotal_minor").notNull().default(0),
    taxMinor: moneyMinor("tax_minor").notNull().default(0),
    totalMinor: moneyMinor("total_minor").notNull().default(0),
    amountPaidMinor: moneyMinor("amount_paid_minor").notNull().default(0),
    /** Whole basis points, e.g. 1500 = 15% VAT. Snapshot at issue time. */
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    description: text("description"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    remindersSent: integer("reminders_sent").notNull().default(0),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    /** Accounting system reference (e.g. Xero InvoiceID). */
    externalId: text("external_id"),
    externalProvider: text("external_provider"),
    syncStatus: text("sync_status", { enum: ["not_synced", "synced", "error"] })
      .notNull()
      .default("not_synced"),
    syncError: text("sync_error"),
    ...timestamps(),
  },
  (t) => [
    index("invoices_org_idx").on(t.organisationId),
    index("invoices_status_idx").on(t.status),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitMinor: moneyMinor("unit_minor").notNull(),
    amountMinor: moneyMinor("amount_minor").notNull(),
    clientServiceId: uuid("client_service_id"),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId)],
);

export const PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
] as const;

/** Payments recorded from verified provider webhooks. Idempotent on provider + provider id. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull(),
    amountMinor: moneyMinor("amount_minor").notNull(),
    currency: currency(),
    raw: jsonb("raw").$type<Record<string, string>>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_uq").on(t.provider, t.providerPaymentId),
    index("payments_org_idx").on(t.organisationId),
  ],
);
