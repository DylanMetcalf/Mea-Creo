import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { organisations, users } from "./identity";

/**
 * The execution engine: each fix is a finished, evidence-backed change to a client's
 * website (the actual title, the actual JSON-LD, the actual file), with where it goes,
 * how to apply it on the client's CMS and how it is verified on the live site.
 *
 * DRAFT → REVIEW → APPROVED → APPLIED → VERIFIED (or DISMISSED).
 */

export const FIX_STATUSES = [
  "draft",
  "review",
  "approved",
  "applied",
  "verified",
  "dismissed",
] as const;
export type FixStatus = (typeof FIX_STATUSES)[number];

export const FIX_AREAS = ["seo", "technical", "aeo", "geo", "conversion"] as const;
export type FixArea = (typeof FIX_AREAS)[number];

/**
 * confirmed: a measured problem on the live site.
 * improvement: justified by evidence, but the page is not broken without it.
 * hypothesis: worth testing; the outcome is uncertain.
 */
export const FIX_CLASSIFICATIONS = ["confirmed", "improvement", "hypothesis"] as const;
export type FixClassification = (typeof FIX_CLASSIFICATIONS)[number];

export interface FixEvidence {
  source: string;
  observed: string;
  collectedAt: string;
}

/** The finished deliverable. `format` decides how it is shown and copied. */
export interface FixDeliverable {
  format: "text" | "html" | "json-ld" | "file";
  /** Labelled parts, e.g. { label: "Title", value: "…" }. */
  parts: { label: string; value: string }[];
}

/** A machine-checkable condition, re-run against the live page to verify the fix. */
export type FixCheck =
  /** The live value must equal the deliverable part of the same name (edits included). */
  | { type: "title_is" }
  | { type: "meta_description_is" }
  | { type: "h1_is" }
  | { type: "single_h1" }
  | { type: "canonical_present" }
  | { type: "lang_present" }
  | { type: "viewport_present" }
  | { type: "indexable" }
  | { type: "jsonld_type"; anyOf: string[] }
  | { type: "open_graph"; keys: string[] }
  | { type: "phone_link" }
  | { type: "alt_text_complete" }
  | { type: "question_headings"; min: number }
  | { type: "llms_txt" }
  | { type: "sitemap_found" }
  | { type: "robots_sitemap" };

export interface FixHistoryEntry {
  status: FixStatus;
  at: string;
  by: string;
  note?: string;
}

export interface FixVerification {
  at: string;
  passed: boolean;
  observed: string;
  url: string;
}

export const fixes = pgTable(
  "fixes",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    /** Stable rule identifier; with pageUrl it prevents duplicate open fixes. */
    ruleKey: text("rule_key").notNull(),
    pageUrl: text("page_url").notNull(),
    area: text("area", { enum: FIX_AREAS }).notNull(),
    classification: text("classification", { enum: FIX_CLASSIFICATIONS }).notNull(),
    priority: text("priority", { enum: ["high", "medium", "low"] }).notNull(),
    title: text("title").notNull(),
    issue: text("issue").notNull(),
    evidence: jsonb("evidence").$type<FixEvidence[]>().notNull().default([]),
    deliverable: jsonb("deliverable").$type<FixDeliverable>().notNull(),
    /** Exactly where the deliverable goes on the page or site. */
    location: text("location").notNull(),
    /** Step-by-step instructions for the client's CMS at the time of drafting. */
    instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
    benefit: text("benefit").notNull(),
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    uncertainty: text("uncertainty"),
    check: jsonb("check").$type<FixCheck>().notNull(),
    verificationMethod: text("verification_method").notNull(),
    rollback: text("rollback").notNull(),
    status: text("status", { enum: FIX_STATUSES }).notNull().default("draft"),
    history: jsonb("history").$type<FixHistoryEntry[]>().notNull().default([]),
    lastVerification: jsonb("last_verification").$type<FixVerification>(),
    approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("fixes_org_status_idx").on(t.organisationId, t.status),
    index("fixes_rule_idx").on(t.organisationId, t.ruleKey, t.pageUrl),
  ],
);
