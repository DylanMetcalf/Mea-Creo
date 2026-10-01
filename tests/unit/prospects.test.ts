import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { leadActivities, leads } from "@/db/schema";
import type { FetchedPage } from "@/modules/audits/fetcher";
import { buildResearch, extractPeople, pickResearchPages } from "@/modules/prospects/extract";
import { researchLead } from "@/modules/prospects/research";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

const HOME = `<!doctype html><html><head><title>Rockwell Drilling</title>
<meta name="description" content="Exploration and production drilling for mines across Mpumalanga and Limpopo.">
</head><body>
<nav><a href="/about-us">About</a><a href="/our-team">Team</a><a href="/contact">Contact</a><a href="/services">Services</a><a href="/blog/x">Blog</a></nav>
<h1>Drilling you can depend on</h1>
<h2>Exploration drilling</h2><h2>Why choose us?</h2>
<p>Offices in Emalahleni and Polokwane.</p>
<footer>Call <a href="tel:013 555 0100">013 555 0100</a> · <a href="mailto:info@rockwell.example">info@rockwell.example</a>
<a href="https://www.linkedin.com/company/rockwell-drilling">LinkedIn</a></footer>
</body></html>`;

const TEAM = `<html><body><h1>Our team</h1>
<div class="card"><h3>Thandi Nkosi</h3><p>Managing Director</p><a href="https://linkedin.com/in/thandi">in</a></div>
<div class="card"><h3>Pieter van der Merwe</h3><p>Operations Manager</p></div>
<div class="card"><h3>Read more</h3><p>Our services</p></div>
<p>Johan Botha – Chief Financial Officer</p>
</body></html>`;

const CONTACT = `<html><body><h1>Contact us</h1><form><input name="email"></form>
<p>Email sales@rockwell.example or call +27 82 555 0199</p></body></html>`;

describe("Prospect research extraction", () => {
  it("picks the most useful internal pages", () => {
    expect(
      pickResearchPages(["/blog/x", "/contact", "/about-us", "/our-team", "/services", "/careers"]),
    ).toEqual(["/our-team", "/about-us", "/contact", "/services"]);
  });

  it("finds named people with roles, and ignores non-names", () => {
    const people = extractPeople(TEAM, "https://rockwell.example/our-team");
    expect(people.map((p) => [p.name, p.role])).toEqual([
      ["Thandi Nkosi", "Managing Director"],
      ["Pieter van der Merwe", "Operations Manager"],
      ["Johan Botha", "Chief Financial Officer"],
    ]);
    expect(people[0].linkedinUrl).toBe("https://linkedin.com/in/thandi");
    expect(people.every((p) => p.source === "https://rockwell.example/our-team")).toBe(true);
  });

  it("combines contact details and signals across pages", () => {
    const r = buildResearch([
      { url: "https://rockwell.example/", html: HOME },
      { url: "https://rockwell.example/our-team", html: TEAM },
      { url: "https://rockwell.example/contact", html: CONTACT },
    ]);
    expect(r.description).toMatch(/drilling for mines/);
    expect(r.emails).toEqual(["info@rockwell.example", "sales@rockwell.example"]);
    expect(r.phones).toEqual(["+27135550100", "+27825550199"]);
    expect([...r.locations].sort()).toEqual(["Emalahleni", "Polokwane"]);
    expect(r.social.linkedin).toContain("linkedin.com/company/rockwell-drilling");
    expect(r.services).toContain("Exploration drilling");
    expect(r.services).not.toContain("Why choose us?");
    expect(r.signals.hasContactForm).toBe(true);
    expect(r.signals.multipleLocations).toBe(true);
    expect(r.signals.hasBooking).toBe(false);
    expect(r.decisionMakers).toHaveLength(3);
  });
});

describe("researchLead", () => {
  const pages: Record<string, string> = {
    "https://rockwell.example/": HOME,
    "https://rockwell.example/our-team": TEAM,
    "https://rockwell.example/contact": CONTACT,
  };
  const fetcher = async (u: string | URL): Promise<FetchedPage> => {
    const url = new URL(u).href;
    const body = pages[url];
    return {
      url,
      finalUrl: url,
      status: body ? 200 : 404,
      contentType: "text/html",
      body: body ?? "",
      bytes: body?.length ?? 0,
      responseTimeMs: 1,
      redirects: 0,
    };
  };

  it("saves research, fills empty fields, scores and builds the brief", async () => {
    const [lead] = await db
      .insert(leads)
      .values({
        company: "Rockwell Drilling",
        website: "https://rockwell.example",
        industry: "Mining",
      })
      .returning();
    await researchLead(db, lead.id, fetcher);
    const [after] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(after.research?.pagesRead).toHaveLength(3);
    expect(after.contactName).toBe("Thandi Nkosi");
    expect(after.contactRole).toBe("Managing Director");
    expect(after.phone).toBe("+27135550100");
    expect(after.score?.commercialFit.level).toBe("high");
    expect(after.score?.decisionMakerAccess.level).not.toBe("unknown");
    expect(after.brief?.decisionMakers.length).toBeGreaterThanOrEqual(3);
    expect(after.brief?.likelyPackage.entry).toBe("Foundation");
    expect(after.recommendedPackage).toBeTruthy();
    const acts = await db.select().from(leadActivities).where(eq(leadActivities.leadId, lead.id));
    expect(acts.some((a) => a.type === "research")).toBe(true);
  });

  it("only reads the home page when robots.txt disallows crawling", async () => {
    pages["https://blocked.example/"] = HOME;
    pages["https://blocked.example/robots.txt"] = "User-agent: *\nDisallow: /";
    const [lead] = await db
      .insert(leads)
      .values({ company: "Blocked", website: "https://blocked.example" })
      .returning();
    const r = await researchLead(db, lead.id, fetcher);
    expect(r.pagesRead).toEqual(["https://blocked.example/"]);
    expect(r.notes[0]).toMatch(/robots\.txt/);
  });
});
