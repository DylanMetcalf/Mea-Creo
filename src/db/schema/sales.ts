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
import type { AuditResult } from "@/modules/audits/types";
import { createdAt, currency, id, moneyMinor, timestamps } from "./_common";
import { services } from "./commercial";
import { organisations, users } from "./identity";

export const LEAD_STAGES = [
  "new",
  "audit_generated",
  "qualified",
  "contacted",
  "call_booked",
  "call_completed",
  "proposal_draft",
  "proposal_sent",
  "negotiation",
  "accepted",
  "payment_pending",
  "onboarding",
  "active_client",
  "lost",
  "nurture",
  "archived",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  "visibility_report",
  "contact_form",
  "booking",
  "referral",
  "manual",
  "import",
  "sales_scout",
  "linkedin",
  "outreach",
] as const;

export type DimensionLevel = "high" | "medium" | "low" | "unknown";
export interface ScoreDimension {
  level: DimensionLevel;
  reasons: string[];
}
/** Prospect qualification as explained dimensions, never one opaque number. */
export interface LeadScore {
  fit: ScoreDimension;
  visibilityOpportunity: ScoreDimension;
  commercialPotential: ScoreDimension;
  digitalMaturity: ScoreDimension;
  serviceMatch: ScoreDimension & { services: string[] };
  confidence: ScoreDimension;
  scoredAt: string;
}

/** Leads and prospects. Always Mea Creo-internal data (never visible in a client portal). */
export const leads = pgTable(
  "leads",
  {
    id: id(),
    company: text("company").notNull(),
    website: text("website"),
    contactName: text("contact_name"),
    contactRole: text("contact_role"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    industry: text("industry"),
    location: text("location"),
    country: text("country"),
    employeeRange: text("employee_range"),
    goal: text("goal"),
    message: text("message"),
    source: text("source", { enum: LEAD_SOURCES }).notNull().default("manual"),
    sourceDetail: text("source_detail"),
    externalId: text("external_id"),
    utm: jsonb("utm").$type<Record<string, string>>().notNull().default({}),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentText: text("consent_text"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    stage: text("stage", { enum: LEAD_STAGES }).notNull().default("new"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    estimatedMonthlyMinor: moneyMinor("estimated_monthly_minor"),
    currency: currency(),
    score: jsonb("score").$type<LeadScore>(),
    opportunitySummary: text("opportunity_summary"),
    outreachAngle: text("outreach_angle"),
    recommendedServices: jsonb("recommended_services").$type<string[]>().notNull().default([]),
    lostReason: text("lost_reason"),
    /** Set when the lead becomes a client. */
    clientOrganisationId: uuid("client_organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    isDemo: boolean("is_demo").notNull().default(false),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("leads_stage_idx").on(t.stage), index("leads_owner_idx").on(t.ownerId)],
);

export const LEAD_ACTIVITY_TYPES = [
  "note",
  "email",
  "call",
  "meeting",
  "stage_change",
  "audit",
  "proposal",
  "system",
] as const;

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type", { enum: LEAD_ACTIVITY_TYPES }).notNull(),
    summary: text("summary").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("lead_activities_lead_idx").on(t.leadId, t.createdAt)],
);

export const AUDIT_KINDS = ["visibility", "competitor", "self"] as const;
export const AUDIT_STATUSES = ["queued", "running", "complete", "failed"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

/**
 * Visibility audits ("Initial Visibility Snapshot"). Prospect audits belong to no client
 * organisation; client and competitor audits carry the client's organisation id.
 */
export const audits = pgTable(
  "audits",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    competitorId: uuid("competitor_id"),
    kind: text("kind", { enum: AUDIT_KINDS }).notNull().default("visibility"),
    url: text("url").notNull(),
    companyName: text("company_name"),
    status: text("status", { enum: AUDIT_STATUSES }).notNull().default("queued"),
    /** Unguessable token for the shareable public report link. */
    publicToken: text("public_token").notNull().unique(),
    result: jsonb("result").$type<AuditResult>(),
    error: text("error"),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("audits_org_idx").on(t.organisationId), index("audits_lead_idx").on(t.leadId)],
);

export const MEETING_TYPES = [
  "discovery",
  "strategy",
  "onboarding",
  "monthly_review",
  "client",
  "internal",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export const MEETING_STATUSES = [
  "requested",
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

export interface MeetingBriefing {
  generatedAt: string;
  sections: { heading: string; items: string[] }[];
  sources: string[];
}
export interface MeetingOutcome {
  generatedAt: string;
  summary: string;
  needs: string[];
  goals: string[];
  budget?: string;
  timeline?: string;
  objections: string[];
  servicesDiscussed: string[];
  nextSteps: string[];
  followUpEmail: string;
}

export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    /** Client organisation, or null for prospect/internal meetings. */
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    type: text("type", { enum: MEETING_TYPES }).notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: MEETING_STATUSES }).notNull().default("scheduled"),
    location: text("location"),
    meetingUrl: text("meeting_url"),
    attendees: jsonb("attendees").$type<{ name?: string; email: string }[]>().notNull().default([]),
    hostId: uuid("host_id").references(() => users.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    agenda: text("agenda"),
    notes: text("notes"),
    transcript: text("transcript"),
    briefing: jsonb("briefing").$type<MeetingBriefing>(),
    outcome: jsonb("outcome").$type<MeetingOutcome>(),
    ...timestamps(),
  },
  (t) => [
    index("meetings_starts_idx").on(t.startsAt),
    index("meetings_org_idx").on(t.organisationId),
  ],
);

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const proposals = pgTable(
  "proposals",
  {
    id: id(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    number: text("number").notNull().unique(),
    title: text("title").notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("draft"),
    publicToken: text("public_token").notNull().unique(),
    currency: currency(),
    summary: text("summary").notNull().default(""),
    problems: jsonb("problems").$type<string[]>().notNull().default([]),
    goals: jsonb("goals").$type<string[]>().notNull().default([]),
    activities: jsonb("activities").$type<string[]>().notNull().default([]),
    kpis: jsonb("kpis").$type<string[]>().notNull().default([]),
    timeline: text("timeline"),
    assumptions: text("assumptions"),
    terms: text("terms"),
    contractMonths: integer("contract_months").notNull().default(6),
    discountPercent: integer("discount_percent").notNull().default(0),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByName: text("accepted_by_name"),
    acceptedByEmail: text("accepted_by_email"),
    acceptedIp: text("accepted_ip"),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("proposals_lead_idx").on(t.leadId)],
);

export const proposalItems = pgTable(
  "proposal_items",
  {
    id: id(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    setupMinor: moneyMinor("setup_minor").notNull().default(0),
    monthlyMinor: moneyMinor("monthly_minor").notNull().default(0),
    oneOffMinor: moneyMinor("one_off_minor").notNull().default(0),
    optional: boolean("optional").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("proposal_items_proposal_idx").on(t.proposalId)],
);
