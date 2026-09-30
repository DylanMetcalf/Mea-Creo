import type { DimensionLevel, LeadScore, ScoreDimension } from "@/db/schema";
import type { AuditResult } from "@/modules/audits/types";

/**
 * Ideal customer profile. Kept as data so it can move into settings without code changes.
 * Positioning deliberately avoids building around mining, hospitality and agriculture.
 */
export const ICP = {
  strongIndustries: [
    "engineering",
    "manufacturing",
    "industrial",
    "professional services",
    "legal",
    "accounting",
    "consulting",
    "technology",
    "software",
    "logistics",
    "construction",
    "architecture",
    "financial services",
    "specialist contractor",
    "b2b",
    "security",
    "fire protection",
    "healthcare services",
    "education services",
  ],
  weakIndustries: [
    "mining",
    "hospitality",
    "agriculture",
    "restaurant",
    "wedding",
    "tourism",
    "farm",
  ],
  idealEmployeeRanges: ["11-50", "51-200", "10-50", "50-200"],
  smallEmployeeRanges: ["1-10", "2-10"],
};

const dim = (level: DimensionLevel, reasons: string[]): ScoreDimension => ({ level, reasons });

function industryFit(industry?: string | null): ScoreDimension {
  if (!industry) return dim("unknown", ["Industry not provided."]);
  const lower = industry.toLowerCase();
  if (ICP.weakIndustries.some((w) => lower.includes(w)))
    return dim("low", [`${industry} is outside the primary focus industries.`]);
  if (ICP.strongIndustries.some((s) => lower.includes(s)))
    return dim("high", [`${industry} is a core B2B/professional industry for Mea Creo.`]);
  return dim("medium", [
    `${industry} may fit; confirm they sell to businesses with meaningful deal values.`,
  ]);
}

export interface QualificationInput {
  industry?: string | null;
  employeeRange?: string | null;
  goal?: string | null;
  audit?: AuditResult | null;
  website?: string | null;
}

export interface Qualification {
  score: LeadScore;
  recommendedServices: string[];
  opportunitySummary: string;
  outreachAngle: string;
}

/** Explains why a prospect is (or isn't) a good fit, from what we actually know. */
export function qualifyLead(input: QualificationInput): Qualification {
  const audit = input.audit;
  const industry = industryFit(input.industry);

  const size: ScoreDimension = !input.employeeRange
    ? dim("unknown", ["Company size unknown."])
    : ICP.idealEmployeeRanges.includes(input.employeeRange)
      ? dim("high", [`${input.employeeRange} employees is the ideal size range.`])
      : ICP.smallEmployeeRanges.includes(input.employeeRange)
        ? dim("medium", ["Smaller business: fit depends on deal value and budget."])
        : dim("medium", [`${input.employeeRange} employees; they may have internal marketing.`]);

  const fitLevel: DimensionLevel =
    industry.level === "high" && size.level !== "medium"
      ? "high"
      : industry.level === "low"
        ? "low"
        : industry.level === "unknown" && size.level === "unknown"
          ? "unknown"
          : "medium";
  const fit = dim(fitLevel, [...industry.reasons, ...size.reasons]);

  let visibilityOpportunity = dim("unknown", ["No visibility snapshot yet."]);
  let digitalMaturity = dim("unknown", ["No visibility snapshot yet."]);
  const services = new Set<string>();

  if (audit) {
    const issues = audit.counts.critical + audit.counts.improvements;
    const weak = audit.categories.filter(
      (c) => c.status === "critical" || c.status === "needs_attention",
    );
    visibilityOpportunity = dim(issues >= 10 ? "high" : issues >= 5 ? "medium" : "low", [
      `${issues} visibility issues found (${audit.counts.critical} critical).`,
      ...weak.slice(0, 3).map((c) => `${c.label}: ${c.summary}`),
    ]);
    const s = audit.signals;
    const maturitySignals = [
      s.analytics.length > 0 && "analytics installed",
      s.blogPage && "publishes content",
      s.jsonLdTypes.length > 0 && "uses structured data",
      s.caseStudyOrTestimonialSignals.length > 0 && "shows proof",
    ].filter(Boolean) as string[];
    digitalMaturity = dim(
      maturitySignals.length >= 3 ? "high" : maturitySignals.length >= 1 ? "medium" : "low",
      [
        maturitySignals.length
          ? `Has: ${maturitySignals.join(", ")}.`
          : "No analytics, content programme, structured data or visible proof.",
        maturitySignals.length >= 3
          ? "May have internal marketing capability; position as specialist support."
          : "Likely no internal digital specialist.",
      ],
    );

    for (const category of weak) {
      if (category.key === "search" || category.key === "technical") services.add("seo");
      if (category.key === "ai_discoverability") services.add("geo");
      if (category.key === "answer_readiness") services.add("aeo");
      if (category.key === "content") services.add("content-creation");
      if (category.key === "conversion") services.add("conversion-optimisation");
      if (category.key === "social") services.add("linkedin-networking");
      if (category.key === "local") services.add("local-google-visibility");
      if (category.key === "website" && category.status === "critical")
        services.add("website-development");
    }
  }
  if (input.goal && /lead|enquir|client|sales|pipeline/i.test(input.goal))
    services.add("lead-generation");
  if (input.goal && /automat|process|admin|time/i.test(input.goal))
    services.add("automation-consulting");

  const recommendedServices = [...services].slice(0, 5);
  const serviceMatch = {
    ...dim(
      recommendedServices.length >= 2
        ? "high"
        : recommendedServices.length === 1
          ? "medium"
          : "unknown",
      [
        recommendedServices.length
          ? `Needs map to ${recommendedServices.length} core service(s).`
          : "Not enough information to match services yet.",
      ],
    ),
    services: recommendedServices,
  };

  const commercialPotential = dim(
    fit.level === "high" && visibilityOpportunity.level !== "low"
      ? "high"
      : fit.level === "low"
        ? "low"
        : fit.level === "unknown"
          ? "unknown"
          : "medium",
    [
      fit.level === "high"
        ? "B2B business in the ideal size range, where visibility usually has real commercial value."
        : "Commercial value depends on deal size, which isn't known yet.",
      input.goal ? `Stated goal: "${input.goal}".` : "No goal stated.",
    ],
  );

  const known = [input.industry, input.employeeRange, input.goal, audit].filter(Boolean).length;
  const confidence = dim(known >= 4 ? "high" : known >= 2 ? "medium" : "low", [
    `Based on ${known} of 4 data points (industry, size, goal, visibility snapshot).`,
  ]);

  const topOpportunity = audit?.opportunities[0];
  const opportunitySummary = audit
    ? `${audit.headline}${topOpportunity ? ` Most valuable first step: ${topOpportunity.title.toLowerCase()}` : ""}`
    : "Run a visibility snapshot to identify opportunities.";
  const outreachAngle = topOpportunity
    ? `Lead with their snapshot: "${topOpportunity.title}". Explain in business terms why it matters, and offer a short visibility review call.`
    : "Offer a free visibility snapshot as a useful first step.";

  return {
    score: {
      fit,
      visibilityOpportunity,
      commercialPotential,
      digitalMaturity,
      serviceMatch,
      confidence,
      scoredAt: new Date().toISOString(),
    },
    recommendedServices,
    opportunitySummary,
    outreachAngle,
  };
}
