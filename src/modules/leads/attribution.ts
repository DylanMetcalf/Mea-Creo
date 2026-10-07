import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { leads } from "@/db/schema";

/**
 * First-touch attribution (handoff: lead attribution). The website stores how a visitor
 * first arrived in the `mc_source` cookie, and only after they accept analytics cookies
 * (see src/components/site/consent.tsx and the Cookie notice). When that visitor becomes
 * a lead, the values are copied onto the lead. Without consent nothing is recorded.
 */

export const CONSENT_COOKIE = "mc_consent";
export const SOURCE_COOKIE = "mc_source";

const KEYS = [
  "ref",
  "landing",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "at",
] as const;

/** Parses the cookie defensively: known keys only, short strings only. */
export function parseSourceCookie(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const key of KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 200);
    }
    return out;
  } catch {
    return {};
  }
}

export const CHANNELS = [
  "Organic search",
  "AI assistant",
  "Paid",
  "Social",
  "Email",
  "Referral",
  "Direct",
  "Unknown",
] as const;
export type Channel = (typeof CHANNELS)[number];

/** Groups a lead's attribution (or its source when there's none) into a reporting channel. */
export function channelFor(attribution: Record<string, string> | null | undefined): Channel {
  const a = attribution ?? {};
  if (!Object.keys(a).length) return "Unknown";
  const medium = (a.utm_medium ?? "").toLowerCase();
  const ref = (a.ref ?? "").toLowerCase();
  if (/cpc|ppc|paid|display|ads?$/.test(medium)) return "Paid";
  if (medium === "email" || medium === "newsletter") return "Email";
  if (/chatgpt|openai|perplexity|gemini|copilot|claude\.ai|you\.com/.test(ref) || medium === "ai")
    return "AI assistant";
  if (/(^|\.)google\.|bing\.com|duckduckgo|yahoo\.|ecosia|brave\.com/.test(ref))
    return medium ? "Referral" : "Organic search";
  if (
    /linkedin|facebook|instagram|twitter|(^|\.)x\.com|t\.co|youtube|tiktok/.test(ref) ||
    medium === "social"
  )
    return "Social";
  if (ref) return "Referral";
  if (a.utm_source) return "Referral";
  return "Direct";
}

/**
 * Copies the visitor's first-touch cookie onto a new lead, if they consented to analytics.
 * Never overwrites attribution that's already there. Call from public form actions.
 */
export async function recordAttribution(db: DbOrTx, leadId: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value !== "analytics") return;
  const attribution = parseSourceCookie(jar.get(SOURCE_COOKIE)?.value);
  if (!Object.keys(attribution).length) return;
  await db
    .update(leads)
    .set({ attribution })
    .where(and(eq(leads.id, leadId), sql`${leads.attribution} = '{}'::jsonb`));
}

const OUTBOUND_SOURCES = new Set(["sales_scout", "manual", "import", "linkedin", "outreach"]);
const WEBSITE_SOURCES = new Set(["visibility_report", "contact_form", "booking"]);

/** Reporting channel for any lead: first-touch attribution first, then how it was created. */
export function leadChannel(lead: {
  source: string;
  attribution: Record<string, string> | null;
}): string {
  if (lead.attribution && Object.keys(lead.attribution).length) return channelFor(lead.attribution);
  if (OUTBOUND_SOURCES.has(lead.source)) return "Outbound";
  if (lead.source === "referral") return "Referral";
  if (lead.source === "existing_client") return "Existing client";
  if (WEBSITE_SOURCES.has(lead.source)) return "Website (no consent)";
  return "Other";
}
