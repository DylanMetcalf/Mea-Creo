import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./_common";
import { organisations, users } from "./identity";
import { leads } from "./sales";

export const CHANNELS = [
  "email",
  "linkedin",
  "phone",
  "whatsapp",
  "contact_form",
  "other",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const COMMUNICATION_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "failed",
  "cancelled",
  "received",
] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const COMMUNICATION_PURPOSES = [
  "consent_request",
  "outreach",
  "follow_up",
  "booking_link",
  "information",
  "proposal",
  "reply",
] as const;

/** How a reply is classified (handoff §27). */
export const RESPONSE_CLASSES = [
  "positive",
  "interested",
  "needs_information",
  "wants_proposal",
  "wants_call",
  "not_interested",
  "wrong_person",
  "unclear",
  "out_of_office",
  "opt_out",
  "spam",
  "other",
] as const;
export type ResponseClass = (typeof RESPONSE_CLASSES)[number];

export const campaigns = pgTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  /** Who this campaign targets, in plain words (e.g. "Engineering firms in Gauteng"). */
  segment: text("segment"),
  channel: text("channel", { enum: CHANNELS }).notNull().default("email"),
  status: text("status", { enum: ["draft", "active", "paused", "completed"] })
    .notNull()
    .default("draft"),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps(),
});

/**
 * Every outreach message and every reply, in one history per prospect: channel, time,
 * message, approval, response classification and next action.
 */
export const communications = pgTable(
  "communications",
  {
    id: id(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
    channel: text("channel", { enum: CHANNELS }).notNull(),
    purpose: text("purpose", { enum: COMMUNICATION_PURPOSES }).notNull().default("outreach"),
    status: text("status", { enum: COMMUNICATION_STATUSES }).notNull(),
    toName: text("to_name"),
    toAddress: text("to_address"),
    subject: text("subject"),
    body: text("body").notNull(),
    /** Why this person, why now: shown to the approver. */
    rationale: text("rationale"),
    classification: text("classification", { enum: RESPONSE_CLASSES }),
    classificationReason: text("classification_reason"),
    nextAction: text("next_action"),
    approvalId: uuid("approval_id"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    sentById: uuid("sent_by_id").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    index("communications_lead_idx").on(t.leadId, t.createdAt),
    index("communications_status_idx").on(t.status),
  ],
);

/**
 * Do-not-contact list. An opt-out from any channel suppresses all future outreach to that
 * person (email, phone or LinkedIn profile), whichever lead record they appear on.
 */
export const suppressions = pgTable(
  "suppressions",
  {
    id: id(),
    /** Normalised identifier: lower-case email, digits-only phone, or LinkedIn URL path. */
    identifier: text("identifier").notNull(),
    kind: text("kind", { enum: ["email", "phone", "linkedin", "domain"] }).notNull(),
    reason: text("reason", { enum: ["opt_out", "bounce", "complaint", "manual"] }).notNull(),
    source: text("source"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("suppressions_identifier_uq").on(t.kind, t.identifier)],
);
