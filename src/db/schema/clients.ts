import { boolean, date, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, currency, id, moneyMinor, timestamps, visibility } from "./_common";
import { organisations, users } from "./identity";

export const BILLING_STATES = [
  "trial",
  "pending_payment",
  "active",
  "payment_due",
  "overdue",
  "suspended",
  "cancelled",
  "archived",
] as const;
export type BillingState = (typeof BILLING_STATES)[number];

export const LIFECYCLE_STAGES = ["onboarding", "active", "paused", "offboarded"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const HEALTH_STATES = ["healthy", "watch", "at_risk", "paused"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export interface HealthReason {
  signal: string;
  detail: string;
  effect: "positive" | "negative" | "neutral";
}

/** Client profile. One row per client organisation. */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .unique()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    industry: text("industry"),
    website: text("website"),
    location: text("location"),
    country: text("country").notNull().default("ZA"),
    currency: currency(),
    linkedinUrl: text("linkedin_url"),
    phone: text("phone"),
    email: text("email"),
    employeeRange: text("employee_range"),
    description: text("description"),
    targetMarket: text("target_market"),
    /** Mea Creo's own account: the proof-of-system "internal client". */
    isInternal: boolean("is_internal").notNull().default(false),
    lifecycle: text("lifecycle", { enum: LIFECYCLE_STAGES }).notNull().default("onboarding"),
    billingState: text("billing_state", { enum: BILLING_STATES })
      .notNull()
      .default("pending_payment"),
    health: text("health", { enum: HEALTH_STATES }).notNull().default("watch"),
    healthReasons: jsonb("health_reasons").$type<HealthReason[]>().notNull().default([]),
    healthCheckedAt: timestamp("health_checked_at", { withTimezone: true }),
    accountManagerId: uuid("account_manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startDate: date("start_date"),
    renewalDate: date("renewal_date"),
    /** Cached sum of active client services. Source of truth is client_services. */
    monthlyValueMinor: moneyMinor("monthly_value_minor").notNull().default(0),
    brandVoice: text("brand_voice"),
    /** Per-client AI spend ceiling in USD micro-units per month (null = global default). */
    aiMonthlyBudgetMicroUsd: moneyMinor("ai_monthly_budget_micro_usd"),
    /** Emergency control: when true, no automation or agent runs for this client. */
    automationPaused: boolean("automation_paused").notNull().default(false),
    onboardingChecklist: jsonb("onboarding_checklist")
      .$type<{ key: string; label: string; done: boolean; owner: "client" | "mea_creo" }[]>()
      .notNull()
      .default([]),
    ...timestamps(),
  },
  (t) => [index("clients_health_idx").on(t.health), index("clients_am_idx").on(t.accountManagerId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    linkedinUrl: text("linkedin_url"),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("contacts_org_idx").on(t.organisationId)],
);

export const FACT_CATEGORIES = [
  "company",
  "services",
  "products",
  "audience",
  "locations",
  "differentiators",
  "keywords",
  "tone",
  "approved_claims",
  "restricted_claims",
  "brand_rules",
  "strategy",
  "preferences",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FACT_SOURCES = ["human", "client", "import", "integration", "agent"] as const;
export const FACT_VERIFICATION = ["verified", "unverified", "rejected"] as const;

/**
 * The Client Brain: structured facts that are the source of truth for agents.
 * Agent-proposed facts stay `unverified` until a human verifies them.
 */
export const clientBrainFacts = pgTable(
  "client_brain_facts",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    category: text("category", { enum: FACT_CATEGORIES }).notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    sourceType: text("source_type", { enum: FACT_SOURCES }).notNull().default("human"),
    sourceRef: text("source_ref"),
    verification: text("verification", { enum: FACT_VERIFICATION }).notNull().default("verified"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("brain_org_cat_idx").on(t.organisationId, t.category)],
);

export const GOAL_STATUSES = ["active", "achieved", "paused", "dropped"] as const;

export const clientGoals = pgTable(
  "client_goals",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    kpi: text("kpi"),
    baseline: text("baseline"),
    target: text("target"),
    current: text("current"),
    dueDate: date("due_date"),
    status: text("status", { enum: GOAL_STATUSES }).notNull().default("active"),
    ...timestamps(),
  },
  (t) => [index("goals_org_idx").on(t.organisationId)],
);

export const competitors = pgTable(
  "competitors",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    notes: text("notes"),
    lastAuditId: uuid("last_audit_id"),
    ...timestamps(),
  },
  (t) => [index("competitors_org_idx").on(t.organisationId)],
);

export const TIMELINE_KINDS = [
  "milestone",
  "work",
  "report",
  "result",
  "meeting",
  "billing",
  "onboarding",
  "opportunity",
] as const;

/** The growth timeline: visible history of work and progress. */
export const timelineEntries = pgTable(
  "timeline_entries",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind", { enum: TIMELINE_KINDS }).notNull().default("work"),
    title: text("title").notNull(),
    description: text("description"),
    link: text("link"),
    visibility: visibility(),
    createdAt: createdAt(),
  },
  (t) => [index("timeline_org_idx").on(t.organisationId, t.occurredAt)],
);

/** Free-form notes on any entity. Internal unless explicitly shared. */
export const notes = pgTable(
  "notes",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibility(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_entity_idx").on(t.entityType, t.entityId)],
);

export const MESSAGE_KINDS = ["message", "support"] as const;

/** Client ↔ Mea Creo conversation, one stream per client organisation. */
export const messages = pgTable(
  "messages",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    fromClient: boolean("from_client").notNull(),
    kind: text("kind", { enum: MESSAGE_KINDS }).notNull().default("message"),
    subject: text("subject"),
    body: text("body").notNull(),
    readByStaffAt: timestamp("read_by_staff_at", { withTimezone: true }),
    readByClientAt: timestamp("read_by_client_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_org_idx").on(t.organisationId, t.createdAt)],
);
