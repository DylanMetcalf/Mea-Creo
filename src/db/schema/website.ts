import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";

export const INSIGHT_CATEGORIES = [
  "seo",
  "geo",
  "aeo",
  "ai",
  "marketing",
  "automation",
  "lead_generation",
  "business_growth",
  "digital_strategy",
  "creative",
  "industry",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  seo: "SEO",
  geo: "GEO",
  aeo: "AEO",
  ai: "AI",
  marketing: "Marketing",
  automation: "Automation",
  lead_generation: "Lead generation",
  business_growth: "Business growth",
  digital_strategy: "Digital strategy",
  creative: "Creative",
  industry: "Industry insights",
};

export const CONTENT_STATUSES = ["draft", "review", "published"] as const;

/** Insights / articles. Body is Markdown, sanitised on render. */
export const insights = pgTable(
  "insights",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    category: text("category", { enum: INSIGHT_CATEGORIES }).notNull(),
    authorName: text("author_name").notNull(),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    faq: jsonb("faq").$type<{ question: string; answer: string }[]>().notNull().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    readingMinutes: integer("reading_minutes").notNull().default(4),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("insights_status_idx").on(t.status, t.publishedAt)],
);

export interface CaseStudyOutcome {
  label: string;
  value: string;
  /** Only verified outcomes are ever displayed publicly. */
  verified: boolean;
  source?: string;
}

export const CASE_STUDY_TYPES = ["case_study", "creative", "campaign", "website"] as const;

/** Case studies and portfolio work. Metrics are hidden unless verified. */
export const caseStudies = pgTable("case_studies", {
  id: id(),
  slug: text("slug").notNull().unique(),
  type: text("type", { enum: CASE_STUDY_TYPES }).notNull().default("case_study"),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  industry: text("industry"),
  summary: text("summary").notNull(),
  challenge: text("challenge"),
  startingPosition: text("starting_position"),
  strategy: text("strategy"),
  workCompleted: text("work_completed"),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  outcomes: jsonb("outcomes").$type<CaseStudyOutcome[]>().notNull().default([]),
  testimonial: jsonb("testimonial").$type<{
    quote: string;
    name: string;
    role?: string;
    permissionConfirmed: boolean;
  }>(),
  timeline: text("timeline"),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  /** Explicit confirmation that the client agreed to be featured. Required to publish. */
  clientPermission: boolean("client_permission").notNull().default(false),
  status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps(),
});

/**
 * Private share links for the photography portfolio. Each link shows chosen categories,
 * can expire, and counts views. The portfolio is never listed publicly or indexed.
 */
export const portfolioLinks = pgTable(
  "portfolio_links",
  {
    id: id(),
    token: text("token").notNull(),
    /** Who it's for, e.g. "Kloof Lodge (Sarah)". Shown only in the workspace. */
    label: text("label").notNull(),
    /** Optional note shown at the top of the shared page. */
    message: text("message"),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdById: text("created_by_id"),
    ...timestamps(),
  },
  (t) => [index("portfolio_links_token_idx").on(t.token)],
);

export const TESTIMONIAL_STATUSES = ["requested", "submitted", "approved", "hidden"] as const;

/**
 * Client testimonials, collected with consent through a private link. Only real quotes,
 * attributed the way the client chose, and only published after Mea Creo approves them.
 */
export const testimonials = pgTable(
  "testimonials",
  {
    id: id(),
    token: text("token").notNull(),
    organisationId: text("organisation_id"),
    /** Who we asked (workspace only). */
    requestedFrom: text("requested_from").notNull(),
    status: text("status", { enum: TESTIMONIAL_STATUSES }).notNull().default("requested"),
    quote: text("quote"),
    name: text("name"),
    role: text("role"),
    company: text("company"),
    industry: text("industry"),
    /** named: name, role and company. anonymous: role and industry only. */
    attribution: text("attribution", { enum: ["named", "anonymous"] }),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("testimonials_token_idx").on(t.token),
    index("testimonials_status_idx").on(t.status),
  ],
);
