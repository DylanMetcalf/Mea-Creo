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
import { id, timestamps } from "./_common";
import { organisations, users } from "./identity";

/**
 * "Fresh prospects": a paid service where Mea Creo researches new prospects for a client
 * every week. Separate from `leads`, which are Mea Creo's own pipeline. Never offered to
 * Mea Creo's own workspace.
 */
export const PROSPECT_PROGRAMME_STATUSES = ["active", "paused"] as const;

export interface ProspectCriteria {
  industries: string[];
  locations: string[];
  roles: string[];
  companySizes: string[];
  /** Anything else: exclusions, existing customers to avoid, preferred sectors. */
  notes: string;
}

export const prospectProgrammes = pgTable(
  "prospect_programmes",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    status: text("status", { enum: PROSPECT_PROGRAMME_STATUSES }).notNull().default("active"),
    weeklyQuota: integer("weekly_quota").notNull().default(10),
    criteria: jsonb("criteria").$type<ProspectCriteria>().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("prospect_programmes_org_idx").on(t.organisationId)],
);

export const CLIENT_PROSPECT_STATUSES = [
  "new",
  "contacted",
  "in_conversation",
  "meeting_booked",
  "not_a_fit",
  "won",
] as const;
export type ClientProspectStatus = (typeof CLIENT_PROSPECT_STATUSES)[number];

export const clientProspects = pgTable(
  "client_prospects",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    /** Monday of the delivery week (South African time). */
    weekOf: date("week_of").notNull(),
    company: text("company").notNull(),
    website: text("website"),
    industry: text("industry"),
    location: text("location"),
    contactName: text("contact_name"),
    contactRole: text("contact_role"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    /** Why this company fits the client's criteria. */
    reason: text("reason").notNull(),
    /** Where the information came from (required, for POPIA transparency). */
    source: text("source").notNull(),
    status: text("status", { enum: CLIENT_PROSPECT_STATUSES }).notNull().default("new"),
    clientNote: text("client_note"),
    /** Null until Mea Creo has reviewed the batch and released it to the client. */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("client_prospects_org_week_idx").on(t.organisationId, t.weekOf)],
);
