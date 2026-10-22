import type { FixCheck } from "@/db/schema";
import type { PageSnapshot, SiteSnapshot } from "./crawl";

export type SiteFiles = Pick<SiteSnapshot, "robotsTxt" | "sitemap" | "llmsTxt">;

/** Checks that need the site files rather than the page. */
export function needsSiteFiles(check: FixCheck): boolean {
  return ["llms_txt", "sitemap_found", "robots_sitemap"].includes(check.type);
}

const quote = (v?: string) => (v ? `"${v}"` : "none");
const norm = (v?: string) =>
  (v ?? "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().toLowerCase();
const same = (live?: string, expected?: string) =>
  Boolean(expected) && norm(live) === norm(expected);

function matches(label: string, live: string | undefined, expected?: string) {
  return {
    passed: same(live, expected),
    observed: `${label} live: ${quote(live)}${same(live, expected) ? " (matches the approved text)" : ""}.`,
  };
}

/** Which deliverable part a check compares against. */
export const CHECK_PART: Partial<Record<FixCheck["type"], string>> = {
  title_is: "Title",
  meta_description_is: "Meta description",
  h1_is: "H1",
};

const EMPTY_PAGE: PageSnapshot = {
  url: "",
  status: 0,
  viewport: false,
  h1: [],
  questionHeadings: [],
  jsonLdTypes: [],
  openGraph: {},
  imageCount: 0,
  imagesMissingAlt: [],
  phoneLinks: 0,
  socialProfiles: {},
  wordCount: 0,
};

/** Pure: evaluates a fix's check against what is live now. */
export function evaluateCheck(
  check: FixCheck,
  pageOrNull: PageSnapshot | null,
  files?: SiteFiles,
  expected?: string,
): { passed: boolean; observed: string } {
  const page = pageOrNull ?? EMPTY_PAGE;
  switch (check.type) {
    case "title_is":
      return matches("Title", page.title, expected);
    case "meta_description_is":
      return matches("Meta description", page.metaDescription, expected);
    case "h1_is":
      return {
        passed: page.h1.length === 1 && same(page.h1[0], expected),
        observed: `H1 heading(s): ${page.h1.map((h) => quote(h)).join(", ") || "none"}.`,
      };
    case "single_h1":
      return {
        passed: page.h1.length === 1,
        observed: `${page.h1.length} H1 heading(s): ${page.h1.map((h) => quote(h)).join(", ") || "none"}.`,
      };
    case "canonical_present":
      return {
        passed: Boolean(page.canonical),
        observed: `Canonical: ${page.canonical ?? "none"}.`,
      };
    case "lang_present":
      return { passed: Boolean(page.lang), observed: `<html lang>: ${page.lang ?? "none"}.` };
    case "viewport_present":
      return {
        passed: page.viewport,
        observed: `Viewport meta tag ${page.viewport ? "present" : "missing"}.`,
      };
    case "indexable": {
      const noindex = /noindex/i.test(page.robotsMeta ?? "");
      return { passed: !noindex, observed: `Robots meta: ${page.robotsMeta ?? "none"}.` };
    }
    case "jsonld_type": {
      const found = page.jsonLdTypes.filter((t) => check.anyOf.includes(t));
      return {
        passed: found.length > 0,
        observed: `Structured data types: ${page.jsonLdTypes.join(", ") || "none"}.`,
      };
    }
    case "open_graph": {
      const missing = check.keys.filter((k) => !page.openGraph[k]);
      return {
        passed: missing.length === 0,
        observed: missing.length
          ? `Missing og:${missing.join(", og:")}.`
          : "All Open Graph tags present.",
      };
    }
    case "phone_link":
      return { passed: page.phoneLinks > 0, observed: `${page.phoneLinks} tel: link(s).` };
    case "alt_text_complete":
      return {
        passed: page.imagesMissingAlt.length === 0,
        observed: `${page.imagesMissingAlt.length} of ${page.imageCount} images without alt text.`,
      };
    case "question_headings":
      return {
        passed: page.questionHeadings.length >= check.min,
        observed: `${page.questionHeadings.length} question heading(s).`,
      };
    case "llms_txt":
      return {
        passed: Boolean(files?.llmsTxt),
        observed: `llms.txt ${files?.llmsTxt ? "found" : "not found"}.`,
      };
    case "sitemap_found":
      return {
        passed: Boolean(files?.sitemap.found),
        observed: files?.sitemap.found
          ? `Sitemap at ${files.sitemap.url} (${files.sitemap.urlCount ?? 0} URLs).`
          : "No XML sitemap found.",
      };
    case "robots_sitemap":
      return {
        passed: (files?.robotsTxt.sitemaps.length ?? 0) > 0,
        observed: `robots.txt lists ${files?.robotsTxt.sitemaps.length ?? 0} sitemap(s).`,
      };
  }
}
