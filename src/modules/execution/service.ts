import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  clientBrainFacts,
  clients,
  type FixDeliverable,
  fixes,
  type FixStatus,
  FIX_STATUSES,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { type Actor, logActivity } from "@/modules/activity/log";
import type { Fetcher } from "@/modules/audits/collect";
import { collectSiteFiles } from "@/modules/audits/collect";
import { normaliseWebsiteUrl, safeFetch } from "@/modules/audits/fetcher";
import { cmsInstructions } from "./cms";
import { crawlSite, readPage } from "./crawl";
import { buildFixes, type ClientFacts } from "./rules";
import { CHECK_PART, evaluateCheck, needsSiteFiles } from "./verify";

export const FIX_STATUS_LABELS: Record<FixStatus, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  applied: "Applied",
  verified: "Verified live",
  dismissed: "Dismissed",
};

/** Draft → Review → Approve → Apply → Verify. Verification only happens by re-checking the site. */
const TRANSITIONS: Record<FixStatus, FixStatus[]> = {
  draft: ["review", "dismissed"],
  review: ["approved", "draft", "dismissed"],
  approved: ["applied", "review"],
  applied: ["approved"],
  verified: [],
  dismissed: ["draft"],
};

export function allowedTransitions(status: FixStatus): FixStatus[] {
  return TRANSITIONS[status];
}

/** Statuses a client may see in the portal: agreed work, not internal drafts. */
export const CLIENT_VISIBLE: FixStatus[] = ["approved", "applied", "verified"];

const who = (actor: Actor) => actor.label ?? "Mea Creo";

export async function clientFacts(
  db: DbOrTx,
  organisationId: string,
): Promise<ClientFacts & { website: string | null }> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!client) throw new AppError("NOT_FOUND");
  const facts = await db
    .select({
      category: clientBrainFacts.category,
      label: clientBrainFacts.label,
      value: clientBrainFacts.value,
    })
    .from(clientBrainFacts)
    .where(
      and(
        eq(clientBrainFacts.organisationId, organisationId),
        eq(clientBrainFacts.verification, "verified"),
        inArray(clientBrainFacts.category, ["services", "locations"]),
      ),
    )
    .orderBy(asc(clientBrainFacts.createdAt));
  const values = (category: string) =>
    facts.filter((f) => f.category === category).map((f) => f.value.trim() || f.label);
  return {
    website: client.website,
    name: client.name,
    description: client.description,
    industry: client.industry,
    location: client.location,
    country: client.country,
    phone: client.phone,
    email: client.email,
    linkedinUrl: client.linkedinUrl,
    cms: client.cms,
    services: values("services"),
    locations: values("locations"),
  };
}

export interface GenerateResult {
  pagesRead: number;
  unreachable: { url: string; reason: string }[];
  created: number;
  refreshed: number;
  unchanged: number;
  needsInfo: string[];
}

/**
 * Reads the client's live site and drafts fixes. Drafts for the same rule and page are
 * refreshed; anything a person has moved past draft is left as it is.
 */
export async function generateFixes(
  db: DbOrTx,
  organisationId: string,
  actor: Actor & { userId?: string },
  fetcher?: Fetcher,
): Promise<GenerateResult> {
  const facts = await clientFacts(db, organisationId);
  if (!facts.website)
    throw new AppError("VALIDATION", { userMessage: "Add the client's website first." });
  const site = await crawlSite(normaliseWebsiteUrl(facts.website), fetcher);
  const { fixes: drafts, needsInfo } = buildFixes(site, facts);

  const open = await db
    .select()
    .from(fixes)
    .where(
      and(
        eq(fixes.organisationId, organisationId),
        notInArray(fixes.status, ["verified", "dismissed"]),
      ),
    );

  let created = 0;
  let refreshed = 0;
  let unchanged = 0;
  const now = new Date().toISOString();
  for (const draft of drafts) {
    const existing = open.find((f) => f.ruleKey === draft.ruleKey && f.pageUrl === draft.pageUrl);
    if (existing && existing.status !== "draft") {
      unchanged++;
      continue;
    }
    if (existing) {
      await db.update(fixes).set(draft).where(eq(fixes.id, existing.id));
      refreshed++;
    } else {
      await db.insert(fixes).values({
        ...draft,
        organisationId,
        status: "draft",
        history: [{ status: "draft", at: now, by: who(actor), note: "Drafted from a live crawl." }],
        createdById: actor.userId,
      });
      created++;
    }
  }

  await logActivity(db, actor, {
    organisationId,
    action: "fixes.generated",
    summary: `Read ${site.pages.length} page(s): ${created} new fix(es), ${refreshed} refreshed`,
    entityType: "client",
    entityId: organisationId,
  });
  return {
    pagesRead: site.pages.length,
    unreachable: site.unreachable,
    created,
    refreshed,
    unchanged,
    needsInfo,
  };
}

export async function listFixes(
  db: DbOrTx,
  organisationId: string,
  statuses: readonly FixStatus[] = FIX_STATUSES,
) {
  return db
    .select()
    .from(fixes)
    .where(and(eq(fixes.organisationId, organisationId), inArray(fixes.status, [...statuses])))
    .orderBy(desc(fixes.updatedAt));
}

/** Always scoped to the organisation, so an id from another client is simply not found. */
export async function getFix(db: DbOrTx, organisationId: string, id: string) {
  const [row] = await db
    .select()
    .from(fixes)
    .where(and(eq(fixes.id, id), eq(fixes.organisationId, organisationId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function transitionFix(
  db: DbOrTx,
  organisationId: string,
  id: string,
  to: FixStatus,
  actor: Actor & { userId?: string },
  note?: string,
): Promise<void> {
  const fix = await getFix(db, organisationId, id);
  if (!TRANSITIONS[fix.status].includes(to))
    throw new AppError("CONFLICT", {
      userMessage: `A fix that is ${FIX_STATUS_LABELS[fix.status].toLowerCase()} can't move to ${FIX_STATUS_LABELS[to].toLowerCase()}.`,
    });
  if (to === "applied" && !note?.trim())
    throw new AppError("VALIDATION", {
      userMessage: "Say where and how it was applied (for example the CMS and the date).",
    });
  const now = new Date();
  await db
    .update(fixes)
    .set({
      status: to,
      history: [
        ...fix.history,
        { status: to, at: now.toISOString(), by: who(actor), note: note?.trim() || undefined },
      ],
      ...(to === "approved" ? { approvedById: actor.userId ?? null, approvedAt: now } : {}),
      ...(to === "applied" ? { appliedAt: now } : {}),
    })
    .where(eq(fixes.id, id));
  await logActivity(db, actor, {
    organisationId,
    action: `fix.${to}`,
    summary: `${FIX_STATUS_LABELS[to]}: ${fix.title}`,
    entityType: "fix",
    entityId: id,
    before: { status: fix.status },
    after: { status: to },
    reason: note,
  });
}

/** Edits the deliverable text. Only drafts and fixes in review can change. */
export async function editDeliverable(
  db: DbOrTx,
  organisationId: string,
  id: string,
  values: string[],
  actor: Actor,
): Promise<void> {
  const fix = await getFix(db, organisationId, id);
  if (fix.status !== "draft" && fix.status !== "review")
    throw new AppError("CONFLICT", {
      userMessage: "Approved work is locked. Send it back to review to change it.",
    });
  if (values.length !== fix.deliverable.parts.length || values.some((v) => !v.trim()))
    throw new AppError("VALIDATION", {
      userMessage: "Every part of the deliverable needs content.",
    });
  const deliverable: FixDeliverable = {
    ...fix.deliverable,
    parts: fix.deliverable.parts.map((p, i) => ({ ...p, value: values[i].trim() })),
  };
  await db.update(fixes).set({ deliverable }).where(eq(fixes.id, id));
  await logActivity(db, actor, {
    organisationId,
    action: "fix.edited",
    summary: `Edited the deliverable: ${fix.title}`,
    entityType: "fix",
    entityId: id,
    before: { deliverable: fix.deliverable },
    after: { deliverable },
  });
}

/** Re-checks the live site. Passing moves the fix to verified; failing keeps it applied. */
export async function verifyFix(
  db: DbOrTx,
  organisationId: string,
  id: string,
  actor: Actor,
  fetcher: Fetcher = (u) => safeFetch(u),
): Promise<{ passed: boolean; observed: string }> {
  const fix = await getFix(db, organisationId, id);
  if (fix.status !== "applied")
    throw new AppError("CONFLICT", { userMessage: "Only applied fixes can be verified." });

  let result: { passed: boolean; observed: string };
  let url = fix.pageUrl;
  try {
    if (needsSiteFiles(fix.check)) {
      const origin = new URL(fix.pageUrl).origin;
      url = origin;
      const files = await collectSiteFiles(origin, fetcher);
      result = evaluateCheck(fix.check, null, files);
    } else {
      const page = await readPage(fix.pageUrl, fetcher);
      const part = CHECK_PART[fix.check.type];
      const expected = part
        ? fix.deliverable.parts.find((p) => p.label === part)?.value
        : undefined;
      result = evaluateCheck(fix.check, page, undefined, expected);
    }
  } catch (error) {
    result = {
      passed: false,
      observed: `Couldn't read the live page: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }

  const now = new Date();
  await db
    .update(fixes)
    .set({
      lastVerification: {
        at: now.toISOString(),
        passed: result.passed,
        observed: result.observed,
        url,
      },
      ...(result.passed
        ? {
            status: "verified" as const,
            verifiedAt: now,
            history: [
              ...fix.history,
              {
                status: "verified" as const,
                at: now.toISOString(),
                by: who(actor),
                note: result.observed,
              },
            ],
          }
        : {}),
    })
    .where(eq(fixes.id, id));
  await logActivity(db, actor, {
    organisationId,
    action: result.passed ? "fix.verified" : "fix.verify_failed",
    summary: `${result.passed ? "Verified live" : "Not live yet"}: ${fix.title}`,
    entityType: "fix",
    entityId: id,
    after: { observed: result.observed },
  });
  return result;
}

/** Refreshes the CMS steps on open fixes after the client's platform changes. */
export async function refreshInstructions(db: DbOrTx, organisationId: string): Promise<void> {
  const facts = await clientFacts(db, organisationId);
  const open = await listFixes(db, organisationId, ["draft", "review", "approved"]);
  const placements: Record<string, Parameters<typeof cmsInstructions>[1]> = {
    "seo.title": "title_meta",
    "seo.meta_description": "title_meta",
    "seo.h1_missing": "page_content",
    "seo.h1_multiple": "page_content",
    "seo.alt_text": "page_content",
    "technical.canonical": "head_code",
    "technical.viewport": "head_code",
    "seo.open_graph": "head_code",
    "technical.lang": "page_language",
    "geo.organization_schema": "structured_data",
    "conversion.phone_link": "page_content",
    "technical.sitemap": "sitemap",
    "technical.robots_sitemap": "robots_file",
    "geo.llms_txt": "root_file",
  };
  for (const fix of open) {
    const placement = placements[fix.ruleKey];
    if (!placement) continue;
    await db
      .update(fixes)
      .set({ instructions: cmsInstructions(facts.cms, placement) })
      .where(eq(fixes.id, fix.id));
  }
}
