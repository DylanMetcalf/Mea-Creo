import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { portfolioLinks } from "@/db/schema";
import {
  createPortfolioLink,
  openPortfolioLink,
  revokePortfolioLink,
} from "@/modules/portfolio/service";
import {
  publishedTestimonials,
  requestTestimonial,
  setTestimonialStatus,
  submitTestimonial,
} from "@/modules/testimonials/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

describe("Portfolio share links", () => {
  it("show only the chosen categories, count views, and stop working when revoked or expired", async () => {
    const link = await createPortfolioLink(db, {
      label: "Kloof Lodge",
      categories: ["wildlife", "not-a-category"],
      expiresInDays: 30,
      userId: "u",
    });
    expect(link.categories).toEqual(["wildlife"]);
    const opened = await openPortfolioLink(db, link.token);
    expect(opened!.photos.length).toBeGreaterThan(0);
    expect(opened!.photos.every((p) => p.category === "wildlife")).toBe(true);
    const [after] = await db.select().from(portfolioLinks).where(eq(portfolioLinks.id, link.id));
    expect(after.viewCount).toBe(1);

    await revokePortfolioLink(db, link.id);
    expect(await openPortfolioLink(db, link.token)).toBeNull();

    const old = await createPortfolioLink(db, {
      label: "Old",
      categories: [],
      expiresInDays: 7,
      userId: "u",
    });
    await db
      .update(portfolioLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(portfolioLinks.id, old.id));
    expect(await openPortfolioLink(db, old.token)).toBeNull();
    expect(await openPortfolioLink(db, "../../etc/passwd")).toBeNull();
  });
});

describe("Testimonials", () => {
  it("are published only after the client consents and Mea Creo approves, credited as chosen", async () => {
    const req = await requestTestimonial(db, { requestedFrom: "Thandi" });
    expect(await publishedTestimonials(db)).toEqual([]);
    await submitTestimonial(db, req.token, {
      quote: "Dylan made us easy to find and even easier to choose.",
      name: "Thandi Nkosi",
      role: "Operations Director",
      company: "Harbourline",
      industry: "Engineering",
      attribution: "anonymous",
      consent: "on",
    });
    expect(await publishedTestimonials(db)).toEqual([]);
    await expect(
      submitTestimonial(db, req.token, {
        quote: "A second go at it should not be possible.",
        name: "X",
        role: "Y",
        industry: "Z",
        attribution: "named",
        consent: "on",
      }),
    ).rejects.toThrow();
    const [row] = await (await import("@/modules/testimonials/service")).listTestimonials(db);
    await setTestimonialStatus(db, row.id, "approved");
    const published = await publishedTestimonials(db);
    expect(published).toHaveLength(1);
    expect(published[0].credit).toBe("Operations Director, Engineering");
    expect(published[0].credit).not.toMatch(/Thandi|Harbourline/);
  });
});
