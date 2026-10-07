import { AUDIT_CATEGORY_LABELS, type AuditCategoryKey, type AuditResult } from "./types";

/**
 * Mea Creo Visibility Index (0–100). Mea Creo's own summary measure, NOT a Google or
 * third-party score. It is derived only from the findings in the report:
 *
 *   finding value  pass = 1, needs improvement = 0.5, failing = 0
 *   finding weight high impact = 3, medium = 2, low = 1
 *   area score     weighted average of its checked findings × 100
 *   index          average of the area scores that could be measured
 *
 * Notes and "not measured" items don't count, and an area with nothing checked is left
 * out rather than scored as zero. Competitor comparisons are context, not part of it.
 */
export const INDEX_METHOD =
  "The Mea Creo Visibility Index is our own measure, not a Google score. Each area is scored from the checks in this report (passed checks count fully, ones that need improvement count half, failing checks count zero; high-impact checks weigh more). The Index is the average of the areas we could measure. Areas we couldn't check from your public website are left out.";

const VALUE = { pass: 1, warn: 0.5, fail: 0 } as const;
const WEIGHT = { high: 3, medium: 2, low: 1 } as const;

export type IndexBand = "strong" | "visible" | "partly_visible" | "hard_to_find";
export const BAND_LABELS: Record<IndexBand, string> = {
  strong: "Strong visibility",
  visible: "Visible, with clear gaps",
  partly_visible: "Partly visible",
  hard_to_find: "Hard to find",
};

export interface VisibilityIndex {
  score: number;
  band: IndexBand;
  areas: { key: AuditCategoryKey; label: string; score: number | null; checks: number }[];
  measuredAreas: number;
}

export function bandFor(score: number): IndexBand {
  return score >= 80
    ? "strong"
    : score >= 60
      ? "visible"
      : score >= 40
        ? "partly_visible"
        : "hard_to_find";
}

export function visibilityIndex(result: AuditResult): VisibilityIndex | null {
  const areas = result.categories
    .filter((c) => c.key !== "competitors")
    .map((c) => {
      let total = 0;
      let weight = 0;
      let checks = 0;
      for (const f of c.findings) {
        if (f.status !== "pass" && f.status !== "warn" && f.status !== "fail") continue;
        const w = WEIGHT[f.impact] ?? 1;
        total += VALUE[f.status] * w;
        weight += w;
        checks++;
      }
      return {
        key: c.key,
        label: AUDIT_CATEGORY_LABELS[c.key] ?? c.label,
        score: weight ? Math.round((total / weight) * 100) : null,
        checks,
      };
    });
  const measured = areas.filter((a) => a.score !== null) as { score: number }[];
  if (!measured.length) return null;
  const score = Math.round(measured.reduce((s, a) => s + a.score, 0) / measured.length);
  return { score, band: bandFor(score), areas, measuredAreas: measured.length };
}

/**
 * Why an area can't be scored from a public scan. A Visibility Report reads only what any
 * visitor or search engine can see; some signals live behind logins or in other companies'
 * data, so they need the business's permission (or don't exist publicly at all).
 */
export const NOT_MEASURED_REASONS: Partial<Record<AuditCategoryKey, string>> = {
  search:
    "Real rankings, impressions and clicks are only in Google Search Console, which only the site owner can share. Connect it and we measure them every month.",
  technical: "We couldn't fetch the pages needed for these checks (the site may block crawlers).",
  website: "The website didn't respond reliably enough during the scan to check its foundations.",
  content: "We couldn't read enough of the page text to assess content.",
  ai_discoverability:
    "We check what AI systems can read on your site. How often assistants actually mention you isn't published by any AI company, so it can't be measured directly.",
  answer_readiness:
    "We couldn't read the page structure needed to check for answers to buyer questions.",
  local:
    "Your Google Business Profile's reviews, categories and calls aren't public data we can read reliably. With your permission we connect it and measure them.",
  social:
    "LinkedIn and Facebook block automated reading, so we only check the profiles your website links to. Engagement needs access to your accounts.",
  conversion:
    "Enquiry numbers live in your analytics, forms or CRM. A public scan can only see whether the website makes it easy to get in touch.",
  competitors: "Needs named competitors to compare against. We add them during your Foundation.",
};
