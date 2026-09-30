/**
 * The Visibility Report data model. Every finding explains:
 * what is happening → why it matters → what should be done.
 * There is deliberately no single overall score.
 */

export const AUDIT_CATEGORY_KEYS = [
  "website",
  "search",
  "technical",
  "content",
  "ai_discoverability",
  "answer_readiness",
  "local",
  "social",
  "conversion",
  "competitors",
] as const;
export type AuditCategoryKey = (typeof AUDIT_CATEGORY_KEYS)[number];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategoryKey, string> = {
  website: "Website foundations",
  search: "Search (SEO)",
  technical: "Technical SEO",
  content: "Content",
  ai_discoverability: "AI discoverability (GEO)",
  answer_readiness: "Answer readiness (AEO)",
  local: "Local & Google presence",
  social: "LinkedIn & social presence",
  conversion: "Conversion & lead capture",
  competitors: "Competitor visibility",
};

export type FindingStatus = "pass" | "warn" | "fail" | "info" | "not_measured";
export type CategoryStatus = "strong" | "needs_attention" | "critical" | "not_measured";
export type Impact = "high" | "medium" | "low";

export interface AuditFinding {
  id: string;
  status: FindingStatus;
  title: string;
  whatIsHappening: string;
  whyItMatters: string;
  whatToDo: string;
  evidence?: string;
  impact: Impact;
}

export interface AuditCategory {
  key: AuditCategoryKey;
  label: string;
  status: CategoryStatus;
  summary: string;
  findings: AuditFinding[];
}

export interface AuditOpportunity {
  title: string;
  category: AuditCategoryKey;
  impact: Impact;
  effort: "low" | "medium" | "high";
  description: string;
  /** Service catalogue slug that addresses this, if any. */
  serviceSlug?: string;
}

/** Raw observations, kept so findings can be re-derived and compared over time. */
export interface AuditSignals {
  statusCode: number;
  finalUrl: string;
  https: boolean;
  responseTimeMs: number;
  htmlBytes: number;
  title?: string;
  metaDescription?: string;
  lang?: string;
  viewport: boolean;
  canonical?: string;
  robotsMeta?: string;
  h1: string[];
  h2: string[];
  questionHeadings: string[];
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  jsonLdTypes: string[];
  organizationSchema: { name?: string; sameAs: string[]; logo: boolean; address: boolean };
  openGraph: Record<string, string>;
  twitterCard: boolean;
  favicon: boolean;
  analytics: string[];
  robotsTxt: { found: boolean; blocksAll: boolean; sitemaps: string[] };
  sitemap: { found: boolean; url?: string; urlCount?: number };
  llmsTxt: boolean;
  phoneLinks: number;
  emailLinks: number;
  forms: number;
  ctaTexts: string[];
  contactPage: boolean;
  aboutPage: boolean;
  blogPage: boolean;
  caseStudyOrTestimonialSignals: string[];
  socialProfiles: Record<string, string>;
  googleMaps: boolean;
  address: boolean;
  pagesAnalysed: string[];
}

export interface CompetitorComparison {
  name: string;
  url: string;
  auditId?: string;
  highlights: string[];
  considerations: string[];
}

export interface AuditResult {
  version: 1;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  durationMs: number;
  headline: string;
  counts: { strengths: number; improvements: number; critical: number; notMeasured: number };
  categories: AuditCategory[];
  opportunities: AuditOpportunity[];
  competitors: CompetitorComparison[];
  signals: AuditSignals;
  limitations: string[];
}
