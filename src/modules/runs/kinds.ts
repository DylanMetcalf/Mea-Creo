export const RUN_KINDS = {
  client_growth_review: {
    label: "Run Growth",
    description:
      "Runs every workflow the client's active services need, then updates opportunities, health and the timeline.",
    agents: ["orchestrator"],
  },
  visibility_audit: {
    label: "Run Visibility Audit",
    description: "Fresh visibility snapshot across search, AI discovery, content and conversion.",
    agents: ["visibility"],
  },
  seo_analysis: {
    label: "Run SEO Analysis",
    description: "Search and technical findings turned into tasks and page-change approvals.",
    agents: ["visibility", "quality_control"],
  },
  ai_visibility_analysis: {
    label: "Run AI Visibility Analysis",
    description: "Entity clarity, structured data and answer readiness (GEO/AEO).",
    agents: ["visibility", "research"],
  },
  competitor_analysis: {
    label: "Run Competitor Analysis",
    description: "Compares the client's site with their competitors and suggests what to consider.",
    agents: ["research", "strategy"],
  },
  lead_opportunity_scan: {
    label: "Run Lead Opportunity Scan",
    description: "Qualifies prospects and prepares follow-ups for approval.",
    agents: ["lead", "outreach"],
  },
  content_opportunity_scan: {
    label: "Run Content Opportunity Scan",
    description: "Finds content opportunities from questions, gaps and goals, and drafts a brief.",
    agents: ["content"],
  },
  website_conversion_audit: {
    label: "Run Website Conversion Audit",
    description: "Calls to action, enquiry paths, proof and tracking.",
    agents: ["visibility"],
  },
  linkedin_opportunity_scan: {
    label: "Run LinkedIn Opportunity Scan",
    description: "Prepares an assisted networking plan. A person performs every LinkedIn action.",
    agents: ["lead", "outreach"],
  },
  monthly_client_review: {
    label: "Run Monthly Client Review",
    description: "Drafts the monthly report and next month's plan for approval.",
    agents: ["reporting", "quality_control"],
  },
} as const;

export type RunKind = keyof typeof RUN_KINDS;

export function isRunKind(value: string): value is RunKind {
  return value in RUN_KINDS;
}
