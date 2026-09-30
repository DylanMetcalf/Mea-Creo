import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, moneyMinor, timestamps } from "./_common";
import { services } from "./commercial";
import { organisations, users } from "./identity";

// ---------------------------------------------------------------------------
// Run Engine
// ---------------------------------------------------------------------------

export const RUN_STATUSES = ["queued", "running", "complete", "failed", "blocked"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_OUTCOMES = [
  "completed",
  "requires_approval",
  "recommended",
  "blocked",
  "no_action",
] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export interface RunItem {
  title: string;
  outcome: RunOutcome;
  detail?: string;
  link?: string;
  agent?: string;
}

export interface RunSummary {
  headline: string;
  counts: Record<RunOutcome, number>;
  findings: number;
}

export const runs = pgTable(
  "runs",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    triggeredById: uuid("triggered_by_id").references(() => users.id, { onDelete: "set null" }),
    trigger: text("trigger", { enum: ["manual", "schedule", "workflow", "agent"] })
      .notNull()
      .default("manual"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    summary: jsonb("summary").$type<RunSummary>(),
    items: jsonb("items").$type<RunItem[]>().notNull().default([]),
    error: text("error"),
    costMicroUsd: moneyMinor("cost_micro_usd").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("runs_org_idx").on(t.organisationId, t.createdAt)],
);

export const AGENT_RUN_STATUSES = ["succeeded", "failed", "blocked", "skipped"] as const;

/** Every agent action, for debugging, trust and cost control. */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    agent: text("agent").notNull(),
    action: text("action").notNull(),
    promptVersion: text("prompt_version"),
    provider: text("provider"),
    model: text("model"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb("output").$type<Record<string, unknown>>(),
    status: text("status", { enum: AGENT_RUN_STATUSES }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicroUsd: moneyMinor("cost_micro_usd").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    approvalId: uuid("approval_id"),
    humanOverride: text("human_override"),
    createdAt: createdAt(),
  },
  (t) => [
    index("agent_runs_org_idx").on(t.organisationId, t.createdAt),
    index("agent_runs_agent_idx").on(t.agent, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Background jobs and events
// ---------------------------------------------------------------------------

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

/** Minimal durable job queue (FOR UPDATE SKIP LOCKED). See src/jobs/queue.ts. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_ready_idx").on(t.status, t.runAt)],
);

/** Transactional outbox of domain events consumed by the workflow engine. */
export const domainEvents = pgTable(
  "domain_events",
  {
    id: id(),
    type: text("type").notNull(),
    organisationId: uuid("organisation_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("domain_events_unprocessed_idx").on(t.processedAt, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Audit log, notifications, email
// ---------------------------------------------------------------------------

export const ACTOR_TYPES = ["user", "agent", "system", "client", "webhook"] as const;

export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    organisationId: uuid("organisation_id"),
    actorType: text("actor_type", { enum: ACTOR_TYPES }).notNull(),
    actorId: text("actor_id"),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_org_idx").on(t.organisationId, t.createdAt),
    index("activity_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    organisationId: uuid("organisation_id"),
    template: text("template").notNull(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    html: text("html"),
    provider: text("provider").notNull(),
    status: text("status", { enum: ["sent", "failed", "suppressed"] }).notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Integrations and settings
// ---------------------------------------------------------------------------

/** Per-organisation connections (OAuth). Credentials are AES-256-GCM encrypted. */
export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    provider: text("provider").notNull(),
    status: text("status", {
      enum: ["CONNECTED", "ACTION_REQUIRED", "ERROR", "NOT_CONNECTED"],
    }).notNull(),
    credentialsEncrypted: text("credentials_encrypted"),
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
    connectedById: uuid("connected_by_id").references(() => users.id, { onDelete: "set null" }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("integrations_org_kind_provider_uq").on(t.organisationId, t.kind, t.provider),
  ],
);

/** Typed key/value settings per organisation. See src/modules/settings. */
export const settings = pgTable(
  "settings",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedById: uuid("updated_by_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.organisationId, t.key] })],
);

// ---------------------------------------------------------------------------
// Growth intelligence
// ---------------------------------------------------------------------------

export const OPPORTUNITY_KINDS = [
  "upsell",
  "seo",
  "aeo",
  "geo",
  "content",
  "conversion",
  "lead",
  "competitor",
  "technical",
  "linkedin",
] as const;
export const OPPORTUNITY_STATUSES = ["open", "accepted", "dismissed", "converted"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

/** Identified opportunities: potential opportunity → reason → suggested service → priority. */
export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: OPPORTUNITY_KINDS }).notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    suggestedServiceId: uuid("suggested_service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("medium"),
    status: text("status", { enum: OPPORTUNITY_STATUSES }).notNull().default("open"),
    /** Dedupe key so repeated runs update rather than duplicate. */
    fingerprint: text("fingerprint").notNull(),
    source: text("source").notNull(),
    clientVisible: text("client_visible", { enum: ["yes", "no"] })
      .notNull()
      .default("no"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("opportunities_fingerprint_uq").on(t.organisationId, t.fingerprint),
    index("opportunities_status_idx").on(t.status),
  ],
);
