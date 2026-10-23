import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { clientBrainFacts, clients, fixes } from "@/db/schema";
import type { FetchedPage } from "@/modules/audits/fetcher";
import { choosePaths, crawlSite, snapshotPage } from "@/modules/execution/crawl";
import { buildFixes, clip, telHref, type ClientFacts } from "@/modules/execution/rules";
import {
  editDeliverable,
  generateFixes,
  getFix,
  listFixes,
  transitionFix,
  verifyFix,
} from "@/modules/execution/service";
import { evaluateCheck } from "@/modules/execution/verify";
import { createClientOrganisation } from "@/modules/onboarding/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

const HOME = `<!doctype html><html><head><title>Home</title></head><body>
<nav><a href="/services">Services</a><a href="/contact">Contact</a><a href="/logo.png">x</a></nav>
<img src="/team.jpg"><img src="/logo.png" alt="Rockwell logo">
<p>Call 013 555 0100</p></body></html>`;
const SERVICES = `<html lang="en"><head><title>Home</title>
<link rel="canonical" href="https://rockwell.example/services"></head><body>
<h1>Exploration drilling</h1><h1>Production drilling</h1>
<p>We drill exploration and production holes for mines across Mpumalanga and Limpopo with our own rigs and crews.</p>
</body></html>`;

function site(pages: Record<string, string>) {
  return async (u: string | URL): Promise<FetchedPage> => {
    const url = new URL(u).href;
    const body = pages[url];
    return {
      url,
      finalUrl: url,
      status: body === undefined ? 404 : 200,
      contentType: url.endsWith(".txt") || url.endsWith(".xml") ? "text/plain" : "text/html",
      body: body ?? "",
      bytes: body?.length ?? 0,
      responseTimeMs: 1,
      redirects: 0,
    };
  };
}

const live: Record<string, string> = {
  "https://rockwell.example/": HOME,
  "https://rockwell.example/services": SERVICES,
};

const facts: ClientFacts = {
  name: "Rockwell Drilling",
  description:
    "Rockwell Drilling provides exploration and production drilling for mines in Mpumalanga and Limpopo.",
  industry: "Mining services",
  location: "Emalahleni",
  country: "ZA",
  phone: "013 555 0100",
  email: "info@rockwell.example",
  linkedinUrl: "https://www.linkedin.com/company/rockwell",
  cms: "wordpress",
  services: ["Exploration drilling", "Production drilling"],
  locations: ["Mpumalanga"],
};

describe("execution engine rules", () => {
  it("clips at sentence or word boundaries", () => {
    expect(clip("One. Two words here.", 100)).toBe("One. Two words here.");
    expect(clip("A".repeat(10) + " " + "b".repeat(200), 50).endsWith("…")).toBe(true);
    expect(telHref("013 555 0100", "ZA")).toBe("+27135550100");
  });

  it("chooses key internal pages and skips files", () => {
    expect(choosePaths(["/blog/a", "/logo.png", "/contact", "/", "/wp-admin/x"], 5)).toEqual([
      "/contact",
      "/blog/a",
    ]);
  });

  it("writes finished deliverables from observed evidence and verified facts", async () => {
    const snapshot = await crawlSite(new URL("https://rockwell.example/"), site(live));
    expect(snapshot.pages.map((p) => p.url)).toEqual([
      "https://rockwell.example/",
      "https://rockwell.example/services",
    ]);
    expect(snapshot.unreachable.map((u) => u.url)).toEqual(["https://rockwell.example/contact"]);

    const { fixes: drafts } = buildFixes(snapshot, facts);
    const by = (key: string, page = "https://rockwell.example/") =>
      drafts.find((f) => f.ruleKey === key && f.pageUrl === page);

    const title = by("seo.title")!;
    expect(title.deliverable.parts[0].value).toBe(
      "Exploration drilling in Mpumalanga | Rockwell Drilling",
    );
    expect(title.evidence[0].observed).toContain("<title>Home</title>");
    expect(title.instructions.join(" ")).toMatch(/Yoast SEO or Rank Math/);

    // Duplicate inner-page title: rewritten from the page's own H1.
    expect(by("seo.title", "https://rockwell.example/services")!.deliverable.parts[0].value).toBe(
      "Exploration drilling | Rockwell Drilling",
    );
    expect(by("seo.h1_multiple", "https://rockwell.example/services")).toBeDefined();
    expect(
      by("seo.meta_description", "https://rockwell.example/services")!.deliverable.parts[0].value,
    ).toMatch(/^We drill exploration/);

    const org = by("geo.organization_schema")!;
    const json = JSON.parse(org.deliverable.parts[0].value.replace(/<\/?script[^>]*>/g, ""));
    expect(json).toMatchObject({
      "@type": "Organization",
      name: "Rockwell Drilling",
      telephone: "+27135550100",
      sameAs: ["https://www.linkedin.com/company/rockwell"],
    });
    expect(by("conversion.phone_link")!.deliverable.parts[0].value).toBe(
      '<a href="tel:+27135550100">013 555 0100</a>',
    );
    expect(by("seo.alt_text")!.deliverable.parts[0].value).toBe("/team.jpg");
    expect(by("aeo.faq")!.deliverable.parts[0].value).toContain(
      "What services does Rockwell Drilling offer?",
    );
    expect(drafts.find((f) => f.ruleKey === "geo.llms_txt")!.classification).toBe("hypothesis");
    expect(drafts.find((f) => f.ruleKey === "technical.sitemap")).toBeDefined();
  });

  it("reports what is missing instead of inventing content", async () => {
    const snapshot = await crawlSite(new URL("https://rockwell.example/"), site(live));
    const { fixes: drafts, needsInfo } = buildFixes(snapshot, {
      ...facts,
      description: null,
      industry: null,
      services: [],
      phone: null,
      email: null,
      location: null,
      locations: [],
    });
    expect(
      drafts.find((f) => f.ruleKey === "seo.title" && f.pageUrl.endsWith(".example/")),
    ).toBeUndefined();
    expect(drafts.find((f) => f.ruleKey === "aeo.faq")).toBeUndefined();
    expect(needsInfo.join(" ")).toMatch(/Home page title/);
    const org = drafts.find((f) => f.ruleKey === "geo.organization_schema")!;
    expect(org.deliverable.parts[0].value).not.toContain("telephone");
  });

  it('treats alt="" as decorative and reads accordion questions', () => {
    const page = snapshotPage(
      `<html><body><img src="/logo.png" alt=""><img src="/a.jpg"><img src="/b.jpg" alt="b.jpg">
      <details><summary><h3>Do you work outside South Africa?</h3><span>+</span></summary></details>
      <details><summary>How long does SEO take?+</summary></details></body></html>`,
      "https://x.example/",
      200,
    );
    expect(page.imagesMissingAlt).toEqual(["/a.jpg", "/b.jpg"]);
    expect(page.questionHeadings).toEqual([
      "Do you work outside South Africa?",
      "How long does SEO take?",
    ]);
  });

  it("checks the live value against the approved text", () => {
    const page = snapshotPage(SERVICES, "https://rockwell.example/services", 200);
    expect(evaluateCheck({ type: "title_is" }, page, undefined, "Home").passed).toBe(true);
    expect(evaluateCheck({ type: "title_is" }, page, undefined, "Other").passed).toBe(false);
    expect(evaluateCheck({ type: "single_h1" }, page).passed).toBe(false);
    expect(evaluateCheck({ type: "canonical_present" }, page).passed).toBe(true);
  });
});

describe("execution workflow", () => {
  let orgId: string;
  let otherOrgId: string;
  const actor = { type: "user" as const, id: "u", label: "Dylan" };

  beforeAll(async () => {
    orgId = await createClientOrganisation(db, {
      name: "Rockwell Drilling",
      website: "https://rockwell.example",
      location: "Emalahleni",
    });
    otherOrgId = await createClientOrganisation(db, {
      name: "Other Co",
      website: "https://other.example",
    });
    await db
      .update(clients)
      .set({ phone: "013 555 0100" })
      .where(eq(clients.organisationId, orgId));
    await db.insert(clientBrainFacts).values([
      {
        organisationId: orgId,
        category: "services",
        label: "Service",
        value: "Exploration drilling",
      },
      {
        organisationId: orgId,
        category: "services",
        label: "Service",
        value: "Unverified claim",
        verification: "unverified",
      },
    ]);
  });

  it("drafts fixes once, from verified facts only, and refreshes drafts on re-run", async () => {
    const first = await generateFixes(db, orgId, actor, site(live));
    expect(first.created).toBeGreaterThan(5);
    const all = await listFixes(db, orgId);
    expect(JSON.stringify(all)).not.toContain("Unverified claim");
    const again = await generateFixes(db, orgId, actor, site(live));
    expect(again.created).toBe(0);
    expect(again.refreshed).toBe(first.created);
  });

  it("enforces draft → review → approved → applied → verified", async () => {
    const [title] = (await listFixes(db, orgId)).filter(
      (f) => f.ruleKey === "seo.title" && f.pageUrl === "https://rockwell.example/",
    );
    await expect(transitionFix(db, orgId, title.id, "applied", actor, "x")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await editDeliverable(
      db,
      orgId,
      title.id,
      ["Exploration drilling in Emalahleni | Rockwell"],
      actor,
    );
    await transitionFix(db, orgId, title.id, "review", actor);
    await transitionFix(db, orgId, title.id, "approved", actor);
    await expect(editDeliverable(db, orgId, title.id, ["Changed"], actor)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(transitionFix(db, orgId, title.id, "applied", actor)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await transitionFix(db, orgId, title.id, "applied", actor, "WordPress, Yoast, 22 Oct");

    // Not live yet: stays applied, with the observation recorded.
    const miss = await verifyFix(db, orgId, title.id, actor, site(live));
    expect(miss.passed).toBe(false);
    expect((await getFix(db, orgId, title.id)).status).toBe("applied");

    const fixed = site({
      ...live,
      "https://rockwell.example/": HOME.replace(
        "<title>Home</title>",
        "<title>Exploration drilling in Emalahleni | Rockwell</title>",
      ),
    });
    const hit = await verifyFix(db, orgId, title.id, actor, fixed);
    expect(hit.passed).toBe(true);
    const done = await getFix(db, orgId, title.id);
    expect(done.status).toBe("verified");
    expect(done.history.map((h) => h.status)).toEqual([
      "draft",
      "review",
      "approved",
      "applied",
      "verified",
    ]);
  });

  it("never returns another client's fix", async () => {
    const [any] = await listFixes(db, orgId);
    await expect(getFix(db, otherOrgId, any.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(transitionFix(db, otherOrgId, any.id, "review", actor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await db.select().from(fixes).where(eq(fixes.organisationId, otherOrgId))).toHaveLength(
      0,
    );
  });
});
