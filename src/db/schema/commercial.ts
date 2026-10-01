import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, moneyMinor, timestamps } from "./_common";
import { organisations, users } from "./identity";

export const SERVICE_CATEGORIES = [
  "package",
  "visibility",
  "growth",
  "automation",
  "creative",
  "website",
  "audit",
  "consulting",
  "quality",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const BILLING_TYPES = ["monthly", "once_off", "usage", "on_request"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const AUTOMATION_LEVELS = ["manual", "assisted", "automated"] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

/** Approval levels (see docs/WORKFLOWS.md). */
export const APPROVAL_LEVELS = ["automatic", "client", "internal", "manual"] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/** Price per currency, all integer minor units. Absent currency = not sold in that currency. */
export interface ServicePrice {
  setupMinor?: number;
  monthlyMinor?: number;
  oneOffMinor?: number;
  /** Usage services: price per unit (e.g. per credit). */
  unitMinor?: number;
}
export type ServicePrices = Partial<Record<string, ServicePrice>>;

export const SERVICE_STATUSES = ["active", "draft", "archived"] as const;

/** The configurable service catalogue. Nothing about services is hard-coded. */
export const services = pgTable("services", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category", { enum: SERVICE_CATEGORIES }).notNull(),
  billingType: text("billing_type", { enum: BILLING_TYPES }).notNull().default("monthly"),
  prices: jsonb("prices").$type<ServicePrices>().notNull().default({}),
  includedActivities: jsonb("included_activities").$type<string[]>().notNull().default([]),
  deliverables: jsonb("deliverables").$type<string[]>().notNull().default([]),
  limits: jsonb("limits").$type<string[]>().notNull().default([]),
  kpis: jsonb("kpis").$type<string[]>().notNull().default([]),
  requiredInputs: jsonb("required_inputs").$type<string[]>().notNull().default([]),
  requiredIntegrations: jsonb("required_integrations").$type<string[]>().notNull().default([]),
  /** Agent ids that work on this service (see src/agents/registry.ts). */
  agents: jsonb("agents").$type<string[]>().notNull().default([]),
  /** Run Engine run kinds this service enables for a client. */
  runKinds: jsonb("run_kinds").$type<string[]>().notNull().default([]),
  automationLevel: text("automation_level", { enum: AUTOMATION_LEVELS })
    .notNull()
    .default("assisted"),
  humanInvolvement: text("human_involvement").notNull().default(""),
  defaultApprovalLevel: text("default_approval_level", { enum: APPROVAL_LEVELS })
    .notNull()
    .default("internal"),
  /** Can a client buy this without a sales call (future self-service). */
  selfService: boolean("self_service").notNull().default(false),
  /** Requires a strategy conversation before activation. */
  requiresStrategy: boolean("requires_strategy").notNull().default(true),
  showOnWebsite: boolean("show_on_website").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status", { enum: SERVICE_STATUSES }).notNull().default("active"),
  ...timestamps(),
});

export const packages = pgTable("packages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  contractMonths: integer("contract_months").notNull().default(6),
  /** Whole-percent discount applied to monthly fees of included services. */
  discountPercent: integer("discount_percent").notNull().default(0),
  terms: text("terms"),
  status: text("status", { enum: SERVICE_STATUSES }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

export const packageItems = pgTable(
  "package_items",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    notes: text("notes"),
  },
  (t) => [index("package_items_pkg_idx").on(t.packageId)],
);

export const CLIENT_SERVICE_STATUSES = ["pending", "active", "paused", "cancelled"] as const;
export type ClientServiceStatus = (typeof CLIENT_SERVICE_STATUSES)[number];

/** A service a client has. Prices are copied at sale time so catalogue changes don't alter contracts. */
export const clientServices = pgTable(
  "client_services",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    status: text("status", { enum: CLIENT_SERVICE_STATUSES }).notNull().default("pending"),
    currency: currency(),
    monthlyMinor: moneyMinor("monthly_minor").notNull().default(0),
    setupMinor: moneyMinor("setup_minor").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    /** Why it was paused: billing | client_request | admin. Billing pauses auto-resume on payment. */
    pauseReason: text("pause_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    currentFocus: text("current_focus"),
    ...timestamps(),
  },
  (t) => [index("client_services_org_idx").on(t.organisationId)],
);

export const SERVICE_REQUEST_STATUSES = ["open", "in_review", "approved", "declined"] as const;

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    status: text("status", { enum: SERVICE_REQUEST_STATUSES }).notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("service_requests_org_idx").on(t.organisationId)],
);
