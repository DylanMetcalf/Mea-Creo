import type {
  DecisionMaker,
  DimensionLevel,
  LeadScore,
  ProspectResearch,
  ScoreDimension,
} from "@/db/schema";
import type { AuditResult } from "@/modules/audits/types";
import { SERVICE_CATALOGUE } from "@/modules/services/catalogue";
import { settingsDefaults } from "@/modules/settings/schema";

/**
 * Prospect qualification (handoff §24). No single meaningless number: every dimension has
 * a level and the reasons behind it, so Dylan can see *why* a prospect is worth contacting.
 * The rules (target sectors, poor-fit signals, decision-maker roles, value floor) come from
 * Settings → Qualification and Targets; defaults are below.
 */
export interface QualificationConfig {
  targetIndustries: string[];
  poorFitSignals: string[];
  idealEmployeeRanges: string[];
  decisionMakerRoles: string[];
  minimumMonthlyValueMinor: number | null;
  targetAverageClientValueMinor: number | null;
}

export const DEFAULT_QUALIFICATION: QualificationConfig = {
  ...settingsDefaults.qualification,
  minimumMonthlyValueMinor: settingsDefaults.targets.minimumMonthlyValueMinor,
  targetAverageClientValueMinor: settingsDefaults.targets.targetAverageClientValueMinor,
};

export interface QualificationInput {
  industry?: string | null;
  employeeRange?: string | null;
  goal?: string | null;
  message?: string | null;
  audit?: AuditResult | null;
  website?: string | null;
  source?: string | null;
  estimatedMonthlyMinor?: number | null;
  contactName?: string | null;
  contactRole?: string | null;
  email?: string | null;
  phone?: string | null;
  decisionMakers?: DecisionMaker[];
  research?: ProspectResearch | null;
  /** They replied positively or asked for a call/proposal. */
  engaged?: boolean;
}

export interface PackageRecommendation {
  entry?: string;
  ongoing?: string;
  reason: string;
}

export interface Qualification {
  score: LeadScore;
  recommendedServices: string[];
  recommendedPackage: PackageRecommendation;
  estimatedMonthlyMinor: number | null;
  opportunitySummary: string;
  outreachAngle: string;
}

const dim = (level: DimensionLevel, reasons: string[]): ScoreDimension => ({ level, reasons });
const INBOUND = ["visibility_report", "contact_form", "booking", "referral", "existing_client"];
const rand = (minor: number) =>
  `R${Math.round(minor / 100)
    .toLocaleString("en-ZA")
    .replace(/\s/g, ",")}`;

/** Approved monthly package prices from the catalogue (the live DB can override via `prices`). */
export function packageMonthlyMinor(slug: string): number | null {
  const p = SERVICE_CATALOGUE.find((s) => s.slug === slug)?.prices?.ZAR;
  return p?.monthlyMinor ?? null;
}

function isDecisionRole(role: string | null | undefined, roles: string[]): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return roles.some((r) =>
    new RegExp(`\\b${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower),
  );
}

/** Which package fits, from what we can actually see. Never a price that isn't approved. */
export function recommendPackage(input: QualificationInput): PackageRecommendation {
  const audit = input.audit;
  const r = input.research;
  const complex =
    r?.signals.multipleLocations ||
    r?.signals.ecommerce ||
    (r?.signals.approxPages ?? 0) > 80 ||
    ["201-1000", "1000+"].includes(input.employeeRange ?? "");
  const weak = new Set(
    (audit?.categories ?? [])
      .filter((c) => c.status === "critical" || c.status === "needs_attention")
      .map((c) => c.key),
  );
  const leadGenGap =
    weak.has("conversion") ||
    (r && (!r.signals.hasClearCta || !r.signals.hasContactForm)) ||
    /lead|enquir|client|sales|pipeline/i.test(input.goal ?? "");
  const automationNeed = /automat|crm|process|admin|dashboard|system/i.test(
    `${input.goal ?? ""} ${input.message ?? ""}`,
  );

  if (complex && automationNeed)
    return {
      entry: "package-foundation",
      ongoing: "package-custom",
      reason:
        "Multiple locations, a large site or complex systems: scope a custom programme after a Foundation.",
    };
  if (automationNeed || complex)
    return {
      entry: "package-foundation",
      ongoing: "package-scale",
      reason: automationNeed
        ? "They want systems and automation as well as visibility and leads."
        : "A larger or multi-location business with more to coordinate.",
    };
  if (leadGenGap)
    return {
      entry: "package-foundation",
      ongoing: "package-growth",
      reason: "Visibility gaps plus weak lead capture or a stated need for enquiries.",
    };
  if (audit || r)
    return {
      entry: "package-foundation",
      ongoing: "package-visibility",
      reason: "The main gaps are in how they're found and understood online.",
    };
  return {
    entry: "package-foundation",
    reason: "Not enough information yet: start with a Foundation assessment.",
  };
}

/** Explains why a prospect is (or isn't) a good fit, from what we actually know. */
export function qualifyLead(
  input: QualificationInput,
  config: QualificationConfig = DEFAULT_QUALIFICATION,
): Qualification {
  const audit = input.audit;
  const research = input.research;
  const text = `${input.goal ?? ""} ${input.message ?? ""}`.toLowerCase();

  // Commercial fit: does this kind of business value professional visibility and systems?
  const industry = input.industry?.toLowerCase() ?? "";
  const poorSignals = config.poorFitSignals.filter((p) => text.includes(p.toLowerCase()));
  const sector = config.targetIndustries.find((t) => industry.includes(t.toLowerCase()));
  const commercialFit = poorSignals.length
    ? dim("low", [
        `Their message suggests a poor fit ("${poorSignals[0]}"): Mea Creo isn't a low-price provider.`,
      ])
    : sector
      ? dim("high", [`${input.industry} is a target sector.`])
      : input.industry
        ? dim("medium", [
            `${input.industry} isn't a core sector, but sector alone doesn't decide fit: check they value professional visibility.`,
          ])
        : dim("unknown", ["Industry not known yet."]);

  // Service fit
  const services = new Set<string>();
  const weak = (audit?.categories ?? []).filter(
    (c) => c.status === "critical" || c.status === "needs_attention",
  );
  for (const c of weak) {
    if (c.key === "search" || c.key === "technical") services.add("seo");
    if (c.key === "ai_discoverability") services.add("geo");
    if (c.key === "answer_readiness") services.add("aeo");
    if (c.key === "content") services.add("content-creation");
    if (c.key === "conversion") services.add("conversion-optimisation");
    if (c.key === "social") services.add("linkedin-networking");
    if (c.key === "local") services.add("local-google-visibility");
    if (c.key === "website" && c.status === "critical") services.add("website-development");
  }
  if (/lead|enquir|client|sales|pipeline/.test(text)) services.add("lead-generation");
  if (/automat|process|admin|crm|system/.test(text)) services.add("ai-workflow-automation");
  if (research && !research.signals.hasContactForm) services.add("conversion-optimisation");
  const recommendedServices = [...services].slice(0, 6);
  const serviceFit = {
    ...dim(
      recommendedServices.length >= 2
        ? "high"
        : recommendedServices.length === 1
          ? "medium"
          : "unknown",
      [
        recommendedServices.length
          ? `Their gaps map to ${recommendedServices.length} Mea Creo service(s).`
          : "Not enough information to match services yet.",
      ],
    ),
    services: recommendedServices,
  };

  // Visibility opportunity
  let visibilityOpportunity = dim("unknown", ["No Visibility Report yet."]);
  if (audit) {
    const issues = audit.counts.critical + audit.counts.improvements;
    visibilityOpportunity = dim(issues >= 10 ? "high" : issues >= 5 ? "medium" : "low", [
      `${issues} visibility issues found (${audit.counts.critical} critical).`,
      ...weak.slice(0, 3).map((c) => `${c.label}: ${c.summary}`),
    ]);
  }

  // Package and value
  const recommendedPackage = recommendPackage(input);
  const estimatedMonthlyMinor =
    input.estimatedMonthlyMinor ??
    (recommendedPackage.ongoing ? packageMonthlyMinor(recommendedPackage.ongoing) : null);

  // Budget likelihood
  const budgetReasons: string[] = [];
  let budgetScore = 0;
  if (input.employeeRange && config.idealEmployeeRanges.includes(input.employeeRange)) {
    budgetScore++;
    budgetReasons.push(
      `${input.employeeRange} employees: usually has budget for professional work.`,
    );
  } else if (input.employeeRange === "1-10")
    budgetReasons.push("Small team: budget may be tight; confirm before investing time.");
  const maturity = [
    audit?.signals.analytics.length && "analytics installed",
    (audit?.signals.blogPage || research?.signals.hasBlog) && "publishes content",
    (audit?.signals.caseStudyOrTestimonialSignals.length || research?.signals.hasCaseStudies) &&
      "shows proof",
  ].filter(Boolean) as string[];
  if (maturity.length >= 2) {
    budgetScore++;
    budgetReasons.push(`Already invests in its online presence (${maturity.join(", ")}).`);
  }
  if (input.source && INBOUND.includes(input.source)) {
    budgetScore++;
    budgetReasons.push("They came to us, which signals intent to invest.");
  }
  if (poorSignals.length) budgetScore -= 2;
  const budgetLikelihood = dim(
    budgetScore >= 2
      ? "high"
      : budgetScore === 1
        ? "medium"
        : budgetReasons.length
          ? "low"
          : "unknown",
    budgetReasons.length ? budgetReasons : ["No budget signals yet."],
  );

  // Decision-maker access
  const people = [
    ...(input.contactName
      ? [{ name: input.contactName, role: input.contactRole ?? undefined }]
      : []),
    ...(input.decisionMakers ?? []),
  ];
  const dm = people.find((p) => isDecisionRole(p.role, config.decisionMakerRoles));
  const directContact =
    Boolean(
      input.email && !/^(info|admin|hello|sales|office|enquiries|contact)@/i.test(input.email),
    ) || Boolean(input.phone);
  const decisionMakerAccess = dm
    ? dim(directContact ? "high" : "medium", [
        `${dm.name}${dm.role ? ` (${dm.role})` : ""} looks like a decision maker.`,
        directContact ? "We have a direct way to reach them." : "No direct contact details yet.",
      ])
    : people.length
      ? dim("medium", [
          `Contact known (${people[0].name}); role${people[0].role ? ` "${people[0].role}"` : ""} may not be the decision maker.`,
        ])
      : dim("unknown", ["No contact person identified yet."]);

  // Urgency
  const urgent = /urgent|asap|this month|next month|launch|deadline|soon|quickly/.test(text);
  const urgency =
    input.engaged || input.source === "booking"
      ? dim("high", [
          input.source === "booking" ? "They booked a call." : "They responded and want to talk.",
        ])
      : urgent
        ? dim("medium", ["Their message mentions timing."])
        : audit && audit.counts.critical > 0
          ? dim("medium", [
              `${audit.counts.critical} critical visibility issue(s) are costing them now.`,
            ])
          : dim("unknown", ["No timing signals."]);

  // Recurring value
  const floor = config.minimumMonthlyValueMinor;
  const avg = config.targetAverageClientValueMinor;
  const recurringValue =
    estimatedMonthlyMinor == null
      ? dim("unknown", ["Monthly value not estimated yet."])
      : floor && estimatedMonthlyMinor < floor
        ? dim("low", [
            `Estimated ${rand(estimatedMonthlyMinor)}/month is below the internal floor of ${rand(floor)}.`,
          ])
        : avg && estimatedMonthlyMinor >= avg
          ? dim("high", [
              `Estimated ${rand(estimatedMonthlyMinor)}/month, at or above the target average.`,
            ])
          : dim("medium", [`Estimated ${rand(estimatedMonthlyMinor)}/month.`]);

  // Strategic value
  const strategicValue =
    commercialFit.level === "high" &&
    (recurringValue.level === "high" || budgetLikelihood.level === "high")
      ? dim("high", [
          "A target-sector business with real recurring potential: a good reference client.",
        ])
      : commercialFit.level === "low"
        ? dim("low", ["Unlikely to strengthen Mea Creo's positioning."])
        : commercialFit.level === "unknown"
          ? dim("unknown", ["Depends on sector and size, not known yet."])
          : dim("medium", ["Useful client; limited reference value in target sectors."]);

  // Probability of becoming a good client
  const levels = [commercialFit, budgetLikelihood, decisionMakerAccess, serviceFit].map(
    (d) => d.level,
  );
  const highs = levels.filter((l) => l === "high").length;
  const lows = levels.filter((l) => l === "low").length;
  const clientProbability =
    lows >= 2 || commercialFit.level === "low"
      ? dim("low", ["Several signals point to a poor fit."])
      : highs >= 3 || (highs >= 2 && urgency.level === "high")
        ? dim("high", ["Strong fit, budget and access signals."])
        : highs + levels.filter((l) => l === "medium").length >= 2
          ? dim("medium", ["Promising, with gaps to confirm on a call."])
          : dim("unknown", ["Too little information to judge."]);

  const known = [
    input.industry,
    input.employeeRange,
    input.goal || input.message,
    audit,
    research,
    people.length ? "people" : null,
  ].filter(Boolean).length;
  const confidence = dim(known >= 5 ? "high" : known >= 3 ? "medium" : "low", [
    `Based on ${known} of 6 data points (industry, size, goal, Visibility Report, research, contact).`,
  ]);

  const fit = dim(
    commercialFit.level === "low" || clientProbability.level === "low"
      ? "low"
      : commercialFit.level === "high" && clientProbability.level !== "unknown"
        ? "high"
        : commercialFit.level === "unknown" && clientProbability.level === "unknown"
          ? "unknown"
          : "medium",
    [...commercialFit.reasons, ...clientProbability.reasons],
  );

  const topOpportunity = audit?.opportunities[0];
  const opportunitySummary = audit
    ? `${audit.headline}${topOpportunity ? ` Most valuable first step: ${topOpportunity.title.toLowerCase()}` : ""}`
    : "Run a Visibility Report to identify opportunities.";
  const outreachAngle = topOpportunity
    ? `Lead with one specific finding ("${topOpportunity.title}"), explain in business terms why it matters, and ask whether a short conversation would be useful.`
    : "Offer their free Visibility Report as a useful first step.";

  return {
    score: {
      fit,
      commercialFit,
      serviceFit,
      visibilityOpportunity,
      budgetLikelihood,
      decisionMakerAccess,
      urgency,
      strategicValue,
      recurringValue,
      clientProbability,
      confidence,
      scoredAt: new Date().toISOString(),
    },
    recommendedServices,
    recommendedPackage,
    estimatedMonthlyMinor,
    opportunitySummary,
    outreachAngle,
  };
}
