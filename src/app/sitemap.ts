import { eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { PILLARS } from "@/content/pillars";
import { LEGAL_DOCS } from "@/content/legal";
import { getDb } from "@/db";
import { insights } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const fixed = [
    "",
    "/services",
    "/how-it-works",
    "/visibility-report",
    "/work",
    "/insights",
    "/about",
    "/contact",
    "/book",
  ];
  const articles = await (
    await getDb()
  )
    .select({ slug: insights.slug, updatedAt: insights.updatedAt })
    .from(insights)
    .where(eq(insights.status, "published"));
  return [
    ...fixed.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.8,
    })),
    ...PILLARS.map((p) => ({
      url: `${base}/services/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...articles.map((a) => ({
      url: `${base}/insights/${a.slug}`,
      lastModified: a.updatedAt,
      priority: 0.6,
    })),
    ...LEGAL_DOCS.map((d) => ({ url: `${base}/legal/${d.slug}`, priority: 0.2 })),
  ];
}
