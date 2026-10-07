import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { organisations, users } from "./identity";

/** Handoff §34: every deliverable can move through these stages. */
export const QA_STAGES = [
  "draft",
  "internal_review",
  "qa",
  "client_review",
  "approved",
  "published",
] as const;
export type QaStage = (typeof QA_STAGES)[number];

export const DELIVERABLE_KINDS = [
  "content",
  "website",
  "seo",
  "geo",
  "aeo",
  "social",
  "ads",
  "design",
  "report",
  "document",
  "other",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export interface QaCheck {
  key: string;
  label: string;
  done: boolean;
  by?: string;
  at?: string;
}

export interface QaHistoryEntry {
  stage: QaStage;
  at: string;
  by: string;
  note?: string;
}

export const deliverables = pgTable(
  "deliverables",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: DELIVERABLE_KINDS }).notNull().default("content"),
    /** Where the work lives (a draft URL, document or design link). */
    link: text("link"),
    notes: text("notes"),
    stage: text("stage", { enum: QA_STAGES }).notNull().default("draft"),
    checklist: jsonb("checklist").$type<QaCheck[]>().notNull().default([]),
    history: jsonb("history").$type<QaHistoryEntry[]>().notNull().default([]),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    approvalId: uuid("approval_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("deliverables_stage_idx").on(t.stage),
    index("deliverables_org_idx").on(t.organisationId),
  ],
);
