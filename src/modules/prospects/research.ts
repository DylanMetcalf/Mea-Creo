import "server-only";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { leadActivities, leads, type DecisionMaker } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Fetcher } from "@/modules/audits/collect";
import { safeFetch } from "@/modules/audits/fetcher";
import { extractPageSignals, parseRobotsTxt } from "@/modules/audits/parse";
import { rescoreLead } from "@/modules/leads/scoring";
import { buildResearch, pickResearchPages, type FetchedDoc } from "./extract";

/**
 * Reads a prospect's own public website (home, about, team, contact and services pages,
 * at most six) and records what the business says about itself. Respects robots.txt,
 * re-validates every request against private addresses, and never logs in or bypasses
 * anything. LinkedIn and other platforms are not scraped.
 */
export async function researchWebsite(
  website: string,
  fetcher: Fetcher = (u) => safeFetch(u, { timeoutMs: 10_000 }),
) {
  const home = await fetcher(website);
  if (home.status >= 400)
    throw new AppError("VALIDATION", {
      userMessage: `Their website returned HTTP ${home.status}.`,
    });
  const origin = new URL(home.finalUrl).origin;
  const notes: string[] = [];
  const pages: FetchedDoc[] = [{ url: home.finalUrl, html: home.body }];

  let robotsBlocks = false;
  try {
    const robots = await fetcher(`${origin}/robots.txt`);
    if (robots.status < 300 && !/<html/i.test(robots.body.slice(0, 500)))
      robotsBlocks = parseRobotsTxt(robots.body).blocksAll;
  } catch {
    // No robots.txt: nothing disallowed.
  }
  if (robotsBlocks)
    notes.push(
      "Their robots.txt asks crawlers not to read the site, so only the home page was read.",
    );
  else {
    const signals = extractPageSignals(home.body, home.finalUrl);
    for (const path of pickResearchPages(signals.internalPaths)) {
      try {
        const page = await fetcher(new URL(path, origin));
        if (page.status < 300 && /html/i.test(page.contentType || "text/html"))
          pages.push({ url: page.finalUrl, html: page.body });
      } catch {
        notes.push(`Couldn't read ${path}.`);
      }
    }
  }
  return buildResearch(pages, notes);
}

function mergePeople(existing: DecisionMaker[], found: DecisionMaker[]): DecisionMaker[] {
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  for (const p of found) {
    const key = p.name.toLowerCase();
    const prior = byName.get(key);
    byName.set(
      key,
      prior ? { ...p, ...prior, linkedinUrl: prior.linkedinUrl ?? p.linkedinUrl } : p,
    );
  }
  return [...byName.values()].slice(0, 20);
}

/** Researches a lead's website, saves the findings, fills empty fields and re-qualifies. */
export async function researchLead(db: DbOrTx, leadId: string, fetcher?: Fetcher) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new AppError("NOT_FOUND");
  if (!lead.website)
    throw new AppError("VALIDATION", { userMessage: "Add the prospect's website first." });
  let research;
  try {
    research = await researchWebsite(lead.website, fetcher);
  } catch (error) {
    logger.warn({ err: String(error), leadId }, "prospect research failed");
    if (error instanceof AppError) throw error;
    throw new AppError("VALIDATION", {
      userMessage: "We couldn't read their website. Check the address and try again.",
      cause: error,
    });
  }
  const dm = research.decisionMakers[0];
  await db
    .update(leads)
    .set({
      research,
      decisionMakers: mergePeople(lead.decisionMakers, research.decisionMakers),
      phone: lead.phone ?? research.phones[0] ?? null,
      location: lead.location ?? (research.locations.join(", ") || null),
      contactName: lead.contactName ?? dm?.name ?? null,
      contactRole: lead.contactName ? lead.contactRole : (dm?.role ?? lead.contactRole),
      email: lead.email ?? research.emails[0] ?? null,
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, leadId));
  await db.insert(leadActivities).values({
    leadId,
    type: "research",
    summary: `Website researched: ${research.pagesRead.length} page(s), ${research.decisionMakers.length} named people, ${research.emails.length} email(s), ${research.phones.length} phone number(s).`,
  });
  await rescoreLead(db, leadId);
  return research;
}
