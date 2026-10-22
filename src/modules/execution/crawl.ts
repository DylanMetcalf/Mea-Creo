import { parse } from "node-html-parser";
import { collectSiteFiles, type Fetcher } from "@/modules/audits/collect";
import { safeFetch } from "@/modules/audits/fetcher";
import { extractPageSignals } from "@/modules/audits/parse";
import type { AuditSignals } from "@/modules/audits/types";

/** What the engine observed on one page of the live site. */
export interface PageSnapshot {
  url: string;
  status: number;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robotsMeta?: string;
  lang?: string;
  viewport: boolean;
  h1: string[];
  questionHeadings: string[];
  jsonLdTypes: string[];
  openGraph: Record<string, string>;
  imageCount: number;
  /** Image sources without meaningful alt text (first 20). */
  imagesMissingAlt: string[];
  phoneLinks: number;
  socialProfiles: Record<string, string>;
  wordCount: number;
  /** First substantial paragraph, used only to summarise the page in its own words. */
  leadParagraph?: string;
}

export interface SiteSnapshot {
  origin: string;
  collectedAt: string;
  pages: PageSnapshot[];
  robotsTxt: AuditSignals["robotsTxt"];
  sitemap: AuditSignals["sitemap"];
  llmsTxt: boolean;
  /** Pages we tried but could not read, with the reason. */
  unreachable: { url: string; reason: string }[];
}

const SKIP_PATH =
  /\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?|mp4|mp3|css|js|xml|txt)$|\/(wp-admin|wp-login|cart|checkout|account|login|signin|feed|tag|author)(\/|$)/i;
const PRIORITY_PATH = /contact|about|service|pricing|faq|solution|product|what-we-do|work/i;

/** Pure: everything the engine needs from one HTML document. */
export function snapshotPage(html: string, url: string, status: number): PageSnapshot {
  const signals = extractPageSignals(html, url);
  const root = parse(html, { comment: false });
  const missing = root
    .querySelectorAll("img")
    .filter((img) => {
      const alt = img.getAttribute("alt");
      return alt === undefined || alt.trim() === "" || /\.(jpe?g|png|webp|gif)$/i.test(alt.trim());
    })
    .map((img) => img.getAttribute("src") ?? img.getAttribute("data-src") ?? "(no src)")
    .slice(0, 20);
  const lead = root
    .querySelectorAll("main p, article p, p")
    .map((p) => p.textContent.replace(/\s+/g, " ").trim())
    .find((t) => t.split(" ").length >= 15 && !/cookie|javascript|©/i.test(t));
  return {
    url,
    status,
    title: signals.title,
    metaDescription: signals.metaDescription,
    canonical: signals.canonical,
    robotsMeta: signals.robotsMeta,
    lang: signals.lang,
    viewport: signals.viewport,
    h1: signals.h1,
    questionHeadings: signals.questionHeadings,
    jsonLdTypes: signals.jsonLdTypes,
    openGraph: signals.openGraph,
    imageCount: signals.imageCount,
    imagesMissingAlt: missing,
    phoneLinks: signals.phoneLinks,
    socialProfiles: signals.socialProfiles,
    wordCount: signals.wordCount,
    leadParagraph: lead,
  };
}

/** Picks which internal pages to read: key pages first, then the rest in link order. */
export function choosePaths(paths: string[], limit: number): string[] {
  const clean = [...new Set(paths.map((p) => p.replace(/\/+$/, "") || "/"))].filter(
    (p) => p !== "/" && !SKIP_PATH.test(p) && p.split("/").length <= 4,
  );
  const ranked = [
    ...clean.filter((p) => PRIORITY_PATH.test(p)),
    ...clean.filter((p) => !PRIORITY_PATH.test(p)),
  ];
  return ranked.slice(0, limit);
}

async function fetchPage(fetcher: Fetcher, url: string) {
  const page = await fetcher(url);
  if (page.status >= 400) throw new Error(`HTTP ${page.status}`);
  if (page.contentType && !/html/i.test(page.contentType)) throw new Error("not an HTML page");
  return page;
}

/** Reads one page of the live site (used again when verifying a fix). */
export async function readPage(url: string, fetcher: Fetcher = (u) => safeFetch(u)) {
  const page = await fetchPage(fetcher, url);
  return snapshotPage(page.body, page.finalUrl, page.status);
}

/**
 * Reads the home page, up to `maxPages - 1` internal pages linked from it, and the
 * site files. Every page is fetched through the SSRF-safe fetcher.
 */
export async function crawlSite(
  url: URL,
  fetcher: Fetcher = (u) => safeFetch(u),
  maxPages = 8,
): Promise<SiteSnapshot> {
  const home = await fetchPage(fetcher, url.href);
  const homeUrl = new URL(home.finalUrl);
  const pages = [snapshotPage(home.body, home.finalUrl, home.status)];
  const unreachable: SiteSnapshot["unreachable"] = [];

  const internal = extractPageSignals(home.body, home.finalUrl).internalPaths;
  const targets = choosePaths(internal, maxPages - 1).map((p) => new URL(p, homeUrl.origin).href);
  // Four at a time: quick enough for an interactive run, gentle on the client's server.
  for (let i = 0; i < targets.length; i += 4) {
    const batch = targets.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((t) => fetchPage(fetcher, t)));
    results.forEach((result, j) => {
      if (result.status === "rejected") {
        unreachable.push({
          url: batch[j],
          reason: result.reason instanceof Error ? result.reason.message : "could not be read",
        });
      } else if (!pages.some((p) => p.url === result.value.finalUrl)) {
        const page = result.value;
        pages.push(snapshotPage(page.body, page.finalUrl, page.status));
      }
    });
  }

  const files = await collectSiteFiles(homeUrl.origin, fetcher);
  return {
    origin: homeUrl.origin,
    collectedAt: new Date().toISOString(),
    pages,
    ...files,
    unreachable,
  };
}
