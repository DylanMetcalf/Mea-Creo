import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps, visibility } from "./_common";
import { APPROVAL_LEVELS } from "./commercial";
import { organisations, users } from "./identity";

export const PROJECT_STATUSES = ["planned", "active", "complete", "on_hold"] as const;

export const projects = pgTable(
  "projects",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("active"),
    ...timestamps(),
  },
  (t) => [index("projects_org_idx").on(t.organisationId)],
);

export const TASK_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "waiting",
  "waiting_client",
  "waiting_approval",
  "blocked",
  "complete",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const OPEN_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "waiting",
  "waiting_client",
  "waiting_approval",
  "blocked",
];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_SOURCES = [
  "manual",
  "onboarding",
  "run",
  "agent",
  "client_request",
  "workflow",
  "recurring",
  "meeting",
] as const;

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    /** Client organisation, or the platform organisation for internal Mea Creo work. */
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    clientServiceId: uuid("client_service_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("ready"),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("normal"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    agent: text("agent"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    recurrence: text("recurrence"),
    source: text("source", { enum: TASK_SOURCES }).notNull().default("manual"),
    sourceRef: text("source_ref"),
    visibility: visibility(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("tasks_org_status_idx").on(t.organisationId, t.status),
    index("tasks_assignee_idx").on(t.assigneeId, t.status),
    index("tasks_due_idx").on(t.dueAt),
  ],
);

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_TYPES = [
  "content",
  "report",
  "strategy",
  "campaign",
  "outreach",
  "proposal",
  "website_change",
  "ad_change",
  "budget",
  "recommendation",
  "other",
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

/** What happens when an approval is granted. Executed by the approval engine, never by the UI. */
export interface ApprovalAction {
  type: string;
  payload: Record<string, unknown>;
}

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    level: text("level", { enum: APPROVAL_LEVELS }).notNull(),
    type: text("type", { enum: APPROVAL_TYPES }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** What the approver is looking at: text, markdown or a structured preview. */
    preview: text("preview"),
    requestedAction: text("requested_action").notNull().default("Approve"),
    status: text("status", { enum: APPROVAL_STATUSES }).notNull().default("pending"),
    action: jsonb("action").$type<ApprovalAction>(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    requestedByAgent: text("requested_by_agent"),
    runId: uuid("run_id"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionComment: text("decision_comment"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("approvals_org_status_idx").on(t.organisationId, t.status),
    index("approvals_level_idx").on(t.level, t.status),
  ],
);

export const DOCUMENT_CATEGORIES = [
  "contract",
  "proposal",
  "brand_guidelines",
  "logo",
  "image",
  "video",
  "document",
  "report",
  "strategy",
  "meeting_notes",
  "research",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** File metadata. Binary content lives in object storage under `storageKey`. */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    /** All versions of a file share a group id (the first version's id). */
    groupId: uuid("group_id").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    category: text("category", { enum: DOCUMENT_CATEGORIES }).notNull().default("document"),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    description: text("description"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    uploadedByClient: text("uploaded_by_client", { enum: ["yes", "no"] })
      .notNull()
      .default("no"),
    visibility: visibility(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_org_idx").on(t.organisationId, t.createdAt),
    index("documents_group_idx").on(t.groupId),
  ],
);

export const REPORT_STATUSES = ["draft", "in_review", "published"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportMetric {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  note?: string;
  /** Where the number came from, e.g. "Google Search Console". */
  source?: string;
}

/** Report narrative. Activity (what we did) is kept separate from outcomes (what changed). */
export interface ReportContent {
  headline: string;
  whatWeDid: string[];
  whatChanged: string[];
  whatWeLearned: string[];
  opportunities: string[];
  whatHappensNext: string[];
  needsFromYou: string[];
  activityMetrics: ReportMetric[];
  outcomeMetrics: ReportMetric[];
  dataNotes: string[];
}

export const reports = pgTable(
  "reports",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["monthly", "audit", "custom", "internal"] })
      .notNull()
      .default("monthly"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("draft"),
    content: jsonb("content").$type<ReportContent>().notNull(),
    runId: uuid("run_id"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("reports_org_idx").on(t.organisationId, t.createdAt)],
);

export const CONTENT_STAGES = [
  "idea",
  "brief",
  "draft",
  "internal_review",
  "client_approval",
  "scheduled",
  "published",
  "measuring",
  "learning",
] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];

export const CONTENT_CHANNELS = [
  "website",
  "blog",
  "linkedin",
  "social",
  "email",
  "google_business",
  "ads",
] as const;

export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    channel: text("channel", { enum: CONTENT_CHANNELS }).notNull().default("blog"),
    stage: text("stage", { enum: CONTENT_STAGES }).notNull().default("idea"),
    brief: text("brief"),
    body: text("body"),
    targetKeyword: text("target_keyword"),
    rationale: text("rationale"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    approvalId: uuid("approval_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedUrl: text("published_url"),
    performance: jsonb("performance").$type<Record<string, string>>(),
    learning: text("learning"),
    ...timestamps(),
  },
  (t) => [index("content_org_stage_idx").on(t.organisationId, t.stage)],
);
