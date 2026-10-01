import { and, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { audits, clientServices, opportunities, services } from "@/db/schema";
import type { AuditResult } from "@/modules/audits/types";

export interface OpportunityCandidate {
  fingerprint: string;
  kind: (typeof opportunities.$inferInsert)["kind"];
  title: string;
  reason: string;
  evidence: string[];
  serviceSlug?: string;
  priority: "low" | "medium" | "high";
  clientVisible: boolean;
}

/**
 * Upsell and growth rules: potential opportunity → reason → suggested service → priority.
 * Only suggests what is supported by evidence. Never pressures: clients see opportunities
 * only when Mea Creo marks them as client-visible.
 */
export function identifyOpportunities(input: {
  activeServiceSlugs: string[];
  audit: AuditResult | null;
}): OpportunityCandidate[] {
  const has = (slug: string) => input.activeServiceSlugs.includes(slug);
  const cat = (key: string) => input.audit?.categories.find((c) => c.key === key);
  const weak = (key: string) => {
    const c = cat(key);
    return c ? c.status === "critical" || c.status === "needs_attention" : false;
  };
  const issues = (key: string) =>
    cat(key)
      ?.findings.filter((f) => f.status === "fail" || f.status === "warn")
      .map((f) => f.title) ?? [];
  const out: OpportunityCandidate[] = [];

  if (has("seo") && !has("google-ads")) {
    out.push({
      fingerprint: "upsell:google-ads",
      kind: "upsell",
      title: "Capture urgent searches with Google Ads",
      reason:
        "SEO builds visibility over months. Paid search can capture high-intent searches (e.g. urgent or out-of-hours needs) immediately while organic visibility grows.",
      evidence: ["SEO active, no paid search"],
      serviceSlug: "google-ads",
      priority: "medium",
      clientVisible: true,
    });
  }
  if (has("seo") && !has("content-creation") && weak("content")) {
    out.push({
      fingerprint: "upsell:content",
      kind: "content",
      title: "Add a regular content programme",
      reason: "Search visibility is limited by thin or infrequent content.",
      evidence: issues("content"),
      serviceSlug: "content-creation",
      priority: "high",
      clientVisible: true,
    });
  }
  if (!has("conversion-optimisation") && weak("conversion")) {
    out.push({
      fingerprint: "upsell:conversion",
      kind: "conversion",
      title: "Turn more visitors into enquiries",
      reason:
        "The website has conversion gaps, so visibility gains won't fully turn into enquiries.",
      evidence: issues("conversion"),
      serviceSlug: "conversion-optimisation",
      priority: "high",
      clientVisible: true,
    });
  }
  if ((has("seo") || has("geo")) && !has("lead-generation")) {
    out.push({
      fingerprint: "upsell:lead-generation",
      kind: "lead",
      title: "Add proactive lead generation",
      reason:
        "Visibility brings inbound interest; structured outreach opens doors with the right decision makers now.",
      evidence: ["Visibility services active, no outbound programme"],
      serviceSlug: "lead-generation",
      priority: "medium",
      clientVisible: false,
    });
  }
  if (!has("linkedin-networking") && weak("social")) {
    out.push({
      fingerprint: "upsell:linkedin",
      kind: "linkedin",
      title: "Structured LinkedIn networking",
      reason: "LinkedIn presence is weak for a B2B business; buyers check it before engaging.",
      evidence: issues("social"),
      serviceSlug: "linkedin-networking",
      priority: "medium",
      clientVisible: true,
    });
  }
  if (has("seo") && !has("geo") && weak("ai_discoverability")) {
    out.push({
      fingerprint: "upsell:geo",
      kind: "geo",
      title: "Make your business easy for AI search to understand",
      reason:
        "AI discoverability signals are weak: business identity isn't clearly machine-readable.",
      evidence: issues("ai_discoverability"),
      serviceSlug: "geo",
      priority: "medium",
      clientVisible: true,
    });
  }
  if (!has("aeo") && weak("answer_readiness")) {
    out.push({
      fingerprint: "upsell:aeo",
      kind: "aeo",
      title: "Answer your buyers' questions",
      reason:
        "The site doesn't answer common buyer questions, a growing source of search and AI visibility.",
      evidence: issues("answer_readiness"),
      serviceSlug: "aeo",
      priority: "medium",
      clientVisible: true,
    });
  }
  if (
    input.activeServiceSlugs.length >= 2 &&
    !has("reporting-automation") &&
    !has("ai-workflow-automation")
  ) {
    out.push({
      fingerprint: "upsell:automation",
      kind: "upsell",
      title: "Automate repetitive reporting and follow-up",
      reason: "Marketing and sales activity is running without automation support.",
      evidence: ["No automation services active"],
      serviceSlug: "automation-consulting",
      priority: "low",
      clientVisible: false,
    });
  }
  if (weak("technical")) {
    out.push({
      fingerprint: "fix:technical",
      kind: "technical",
      title: "Fix technical visibility issues",
      reason: "Technical issues limit how well search engines crawl and understand the site.",
      evidence: issues("technical"),
      serviceSlug: has("seo") ? undefined : "technical-seo",
      priority: "high",
      clientVisible: true,
    });
  }
  return out;
}

/** Recomputes a client's open opportunities, updating existing ones by fingerprint. */
export async function refreshClientOpportunities(
  db: DbOrTx,
  organisationId: string,
  source = "rules",
): Promise<number> {
  const rows = await db
    .select({ slug: services.slug })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(eq(clientServices.organisationId, organisationId), eq(clientServices.status, "active")),
    );
  const [latest] = await db
    .select({ result: audits.result })
    .from(audits)
    .where(and(eq(audits.organisationId, organisationId), eq(audits.status, "complete")))
    .orderBy(desc(audits.completedAt))
    .limit(1);
  const candidates = identifyOpportunities({
    activeServiceSlugs: rows.map((r) => r.slug),
    audit: latest?.result ?? null,
  });
  const serviceRows = await db.select({ id: services.id, slug: services.slug }).from(services);
  const serviceId = (slug?: string) => serviceRows.find((s) => s.slug === slug)?.id ?? null;

  for (const c of candidates) {
    await db
      .insert(opportunities)
      .values({
        organisationId,
        fingerprint: c.fingerprint,
        kind: c.kind,
        title: c.title,
        reason: c.reason,
        evidence: c.evidence,
        suggestedServiceId: serviceId(c.serviceSlug),
        priority: c.priority,
        source,
        clientVisible: c.clientVisible ? "yes" : "no",
      })
      .onConflictDoUpdate({
        target: [opportunities.organisationId, opportunities.fingerprint],
        set: {
          reason: c.reason,
          evidence: c.evidence,
          priority: c.priority,
          updatedAt: new Date(),
        },
      });
  }
  return candidates.length;
}
