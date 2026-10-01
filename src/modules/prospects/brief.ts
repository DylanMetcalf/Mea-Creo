import type { leads, ProspectBrief } from "@/db/schema";
import type { AuditCategoryKey, AuditResult } from "@/modules/audits/types";
import type { Qualification } from "@/modules/leads/qualify";
import { SERVICE_CATALOGUE } from "@/modules/services/catalogue";

type Lead = typeof leads.$inferSelect;

const failing = (audit: AuditResult | null | undefined, keys: AuditCategoryKey[]) =>
  (audit?.categories ?? [])
    .filter((c) => keys.includes(c.key))
    .flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn"))
    .sort((a, b) => (a.impact === "high" ? -1 : 0) - (b.impact === "high" ? -1 : 0))
    .slice(0, 4)
    .map((f) => `${f.title}: ${f.whatToDo}`);

export const packageName = (slug?: string | null) =>
  slug ? (SERVICE_CATALOGUE.find((s) => s.slug === slug)?.name ?? slug) : undefined;

/**
 * The prospect intelligence brief (handoff §23), built only from what is on record:
 * the lead's details, its latest Visibility Report and public-website research.
 * Where something isn't known it says so rather than guessing.
 */
export function buildProspectBrief(
  lead: Lead,
  q: Qualification,
  audit: AuditResult | null | undefined,
): ProspectBrief {
  const r = lead.research;
  const sources = [
    ...(audit ? [`Visibility Report of ${audit.finalUrl} (${audit.fetchedAt.slice(0, 10)})`] : []),
    ...(r?.pagesRead ?? []),
  ];
  const people = [
    ...(lead.contactName
      ? [
          `${lead.contactName}${lead.contactRole ? `, ${lead.contactRole}` : ""} (contact on record)`,
        ]
      : []),
    ...(lead.decisionMakers ?? [])
      .filter((p) => p.name !== lead.contactName)
      .map((p) => `${p.name}${p.role ? `, ${p.role}` : ""} (from ${p.source})`),
  ];

  const leadGen: string[] = failing(audit, ["conversion"]);
  if (r && !r.signals.hasContactForm)
    leadGen.push("No enquiry form found on the pages read: visitors must email or phone.");
  if (r && !r.signals.hasBooking) leadGen.push("No way to book a call online.");
  if (r && !r.signals.hasCaseStudies)
    leadGen.push("No case studies or testimonials found to reassure buyers.");

  const automation: string[] = [];
  if (r && !r.signals.hasBooking)
    automation.push("Online booking linked to a CRM would remove back-and-forth scheduling.");
  if (/automat|crm|admin|process|manual/i.test(`${lead.goal ?? ""} ${lead.message ?? ""}`))
    automation.push(
      `They mention operations or admin: "${(lead.goal ?? lead.message ?? "").slice(0, 120)}".`,
    );

  const competitors = (audit?.competitors ?? []).map(
    (c) =>
      `${c.name}: ${[...c.highlights.slice(0, 1), ...c.considerations.slice(0, 1)].join("; ")}`,
  );

  const weakest = (audit?.categories ?? []).filter((c) => c.status === "critical");
  const likelyBusinessProblem = weakest.length
    ? `Buyers researching ${lead.industry ? `${lead.industry.toLowerCase()} providers` : "this kind of provider"} are likely to find ${weakest
        .map((c) => c.label.toLowerCase())
        .join(
          ", ",
        )} weak, so ${lead.company} may be less visible or less convincing than its capability deserves.`
    : audit
      ? `The foundations are reasonable; the opportunity is in being found for more searches and turning visitors into enquiries.`
      : "Not known yet: run a Visibility Report or research their website.";

  const top = audit?.opportunities[0];
  const whyContact = top
    ? `A specific, useful observation to share: ${top.title.toLowerCase()} (${top.impact} impact). ${q.score.commercialFit.reasons[0] ?? ""}`.trim()
    : q.score.commercialFit.level === "high"
      ? `${q.score.commercialFit.reasons[0]} A Visibility Report would give a concrete reason to reach out.`
      : "No specific reason yet. Research first.";

  const size = lead.employeeRange ? `${lead.employeeRange} employees` : undefined;
  return {
    generatedAt: new Date().toISOString(),
    company: lead.company,
    industry: lead.industry ?? undefined,
    size,
    location: lead.location || r?.locations.join(", ") || undefined,
    website: lead.website ?? undefined,
    decisionMakers: people,
    currentVisibility: audit
      ? audit.headline
      : r
        ? `Website read (${r.pagesRead.length} pages); no Visibility Report yet.`
        : "Not assessed yet.",
    seoOpportunities: failing(audit, ["search", "technical"]),
    geoOpportunities: failing(audit, ["ai_discoverability"]),
    aeoOpportunities: failing(audit, ["answer_readiness"]),
    contentOpportunities: failing(audit, ["content", "social"]),
    leadGenerationOpportunities: leadGen.slice(0, 5),
    automationOpportunities: automation,
    competitorObservations: competitors,
    likelyBusinessProblem,
    whyContact,
    likelyPackage: {
      entry: packageName(q.recommendedPackage.entry),
      ongoing: packageName(q.recommendedPackage.ongoing),
      reason: q.recommendedPackage.reason,
    },
    estimatedMonthlyMinor: q.estimatedMonthlyMinor,
    confidence: `${q.score.confidence.level}: ${q.score.confidence.reasons.join(" ")}`,
    sources,
  };
}
