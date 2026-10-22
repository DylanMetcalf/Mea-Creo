import type {
  CmsPlatform,
  FixArea,
  FixCheck,
  FixClassification,
  FixDeliverable,
  FixEvidence,
} from "@/db/schema";
import { cmsInstructions, type Placement } from "./cms";
import type { PageSnapshot, SiteSnapshot } from "./crawl";

/**
 * Pure fix generator. Every fix carries the finished change, built only from what the
 * crawl observed and the client's verified facts. When a deliverable can't be written
 * without inventing something, the rule reports what is missing instead.
 */

export interface ClientFacts {
  name: string;
  description?: string | null;
  industry?: string | null;
  location?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  cms: CmsPlatform;
  /** Verified Brain facts in the "services" category (what the client sells). */
  services: string[];
  /** Verified Brain facts in the "locations" category. */
  locations: string[];
}

export interface FixDraft {
  ruleKey: string;
  pageUrl: string;
  area: FixArea;
  classification: FixClassification;
  priority: "high" | "medium" | "low";
  title: string;
  issue: string;
  evidence: FixEvidence[];
  deliverable: FixDeliverable;
  location: string;
  instructions: string[];
  benefit: string;
  dependencies: string[];
  uncertainty?: string;
  check: FixCheck;
  verificationMethod: string;
  rollback: string;
}

export const TITLE_RANGE = { min: 30, max: 65 } as const;
export const DESCRIPTION_RANGE = { min: 70, max: 170 } as const;
const ORG_TYPES = ["Organization", "LocalBusiness", "ProfessionalService", "Corporation"];

/** Clips at a word boundary, preferring whole sentences. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim().length >= max * 0.5) return out.trim();
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:–-]$/, "")}…`;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pathOf = (url: string) => new URL(url).pathname;
const isHome = (page: PageSnapshot, site: SiteSnapshot) => page.url === site.pages[0]?.url;

function humanisePath(url: string): string {
  const slug = pathOf(url).split("/").filter(Boolean).pop() ?? "";
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

/** What the page is about, in the page's own words (H1, else the title before the brand). */
function pageTopic(page: PageSnapshot, facts: ClientFacts): string {
  const fromH1 = page.h1[0];
  if (fromH1 && fromH1.toLowerCase() !== facts.name.toLowerCase()) return fromH1;
  const fromTitle = page.title?.split(/\s[|–—-]\s/)[0]?.trim();
  if (fromTitle && fromTitle.toLowerCase() !== facts.name.toLowerCase()) return fromTitle;
  return humanisePath(page.url);
}

/** The home page's subject from verified facts: main service (and place, if it fits). */
function homeTopic(facts: ClientFacts): string | null {
  const topic = facts.services[0] ?? facts.industry ?? null;
  if (!topic) return null;
  const place = facts.locations[0] ?? facts.location;
  return place ? `${topic} in ${place}` : topic;
}

function brandTitle(topic: string, name: string): string {
  const suffix = ` | ${name}`;
  const full = `${topic}${suffix}`;
  if (full.length <= 60) return full;
  const room = 60 - suffix.length;
  return room >= 15 ? `${clip(topic, room).replace(/…$/, "")}${suffix}` : clip(topic, 60);
}

function evidence(page: PageSnapshot, site: SiteSnapshot, observed: string): FixEvidence[] {
  return [{ source: `Live fetch of ${page.url}`, observed, collectedAt: site.collectedAt }];
}

const steps = (facts: ClientFacts, placement: Placement) => cmsInstructions(facts.cms, placement);

export function telHref(phone: string, country: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (country === "ZA" && digits.startsWith("0")) return `+27${digits.slice(1)}`;
  return digits;
}

function langFor(country: string): string {
  return { ZA: "en-ZA", GB: "en-GB", US: "en-US", AU: "en-AU", NZ: "en-NZ" }[country] ?? "en";
}

export function buildFixes(
  site: SiteSnapshot,
  facts: ClientFacts,
): { fixes: FixDraft[]; needsInfo: string[] } {
  const fixes: FixDraft[] = [];
  const needsInfo: string[] = [];
  const home = site.pages[0];
  if (!home) return { fixes, needsInfo };

  const titleCounts = new Map<string, number>();
  const descCounts = new Map<string, number>();
  for (const p of site.pages) {
    if (p.title) titleCounts.set(p.title, (titleCounts.get(p.title) ?? 0) + 1);
    if (p.metaDescription)
      descCounts.set(p.metaDescription, (descCounts.get(p.metaDescription) ?? 0) + 1);
  }

  for (const page of site.pages) {
    const onHome = isHome(page, site);
    const label = onHome ? "home page" : `${pathOf(page.url)} page`;

    // ── Indexability ───────────────────────────────────────────────────────────
    if (/noindex/i.test(page.robotsMeta ?? "")) {
      fixes.push({
        ruleKey: "indexability.noindex",
        pageUrl: page.url,
        area: "technical",
        classification: "confirmed",
        priority: "high",
        title: `Let search engines index the ${label}`,
        issue: `The page tells search engines not to index it (robots meta "${page.robotsMeta}"), so it cannot appear in search results or be cited from search.`,
        evidence: evidence(page, site, `<meta name="robots" content="${page.robotsMeta}">`),
        deliverable: {
          format: "html",
          parts: [
            {
              label: "Replace the robots tag with",
              value: '<meta name="robots" content="index, follow">',
            },
          ],
        },
        location: `<head> of ${page.url}`,
        instructions: [
          facts.cms === "wordpress"
            ? "WordPress: Settings → Reading → untick 'Discourage search engines'; in the page's SEO box (Advanced) allow indexing."
            : facts.cms === "wix"
              ? "Wix: Pages & Menu → ⋯ → SEO basics → turn on 'Let search engines index this page'."
              : facts.cms === "squarespace"
                ? "Squarespace: page settings → SEO → turn off 'Hide page from search results'."
                : facts.cms === "shopify"
                  ? "Shopify: check the theme or an app isn't adding noindex (theme.liquid), and the store isn't password protected."
                  : "Remove the noindex robots tag from the page template.",
        ],
        benefit: "The page becomes eligible to appear in search results.",
        dependencies: ["Confirm with the client that this page is meant to be public."],
        uncertainty:
          "Some pages are hidden on purpose (thank-you or private pages). Check before approving.",
        check: { type: "indexable" },
        verificationMethod: `Re-fetch ${page.url} and confirm the robots meta tag no longer contains "noindex".`,
        rollback: `Restore <meta name="robots" content="${page.robotsMeta}">.`,
      });
    }

    // ── Title ──────────────────────────────────────────────────────────────────
    const titleLen = page.title?.length ?? 0;
    const dupTitle = page.title && (titleCounts.get(page.title) ?? 0) > 1 && !onHome;
    if (!page.title || titleLen < TITLE_RANGE.min || titleLen > TITLE_RANGE.max || dupTitle) {
      const topic = onHome ? homeTopic(facts) : pageTopic(page, facts);
      if (!topic) {
        needsInfo.push(
          "Home page title: add the client's main service as a verified Brain fact (Services) or set the industry.",
        );
      } else {
        const proposed = brandTitle(topic, facts.name);
        const problem = !page.title
          ? "has no title"
          : dupTitle
            ? `uses the same title as ${(titleCounts.get(page.title) ?? 1) - 1} other page(s)`
            : titleLen > TITLE_RANGE.max
              ? `has a ${titleLen}-character title that search results will cut off`
              : `has a short ${titleLen}-character title that doesn't say what the page offers`;
        fixes.push({
          ruleKey: "seo.title",
          pageUrl: page.url,
          area: "seo",
          classification: "confirmed",
          priority: onHome ? "high" : "medium",
          title: `Rewrite the title of the ${label}`,
          issue: `The ${label} ${problem}.`,
          evidence: evidence(
            page,
            site,
            `<title>${page.title ?? ""}</title> (${titleLen} characters)`,
          ),
          deliverable: { format: "text", parts: [{ label: "Title", value: proposed }] },
          location: `<title> of ${page.url} (the SEO title field)`,
          instructions: steps(facts, "title_meta"),
          benefit:
            "A specific, unique title tells searchers and engines what the page offers and is the headline of the search result.",
          dependencies: [],
          uncertainty: onHome
            ? undefined
            : "Built from the page's own heading; check it matches how customers search for this.",
          check: { type: "title_is" },
          verificationMethod: `Re-fetch ${page.url} and confirm the <title> is exactly the approved title.`,
          rollback: page.title ? `Restore the title "${page.title}".` : "Remove the title.",
        });
      }
    }

    // ── Meta description ──────────────────────────────────────────────────────
    const descLen = page.metaDescription?.length ?? 0;
    const dupDesc =
      page.metaDescription && (descCounts.get(page.metaDescription) ?? 0) > 1 && !onHome;
    if (
      !page.metaDescription ||
      descLen < DESCRIPTION_RANGE.min ||
      descLen > DESCRIPTION_RANGE.max ||
      dupDesc
    ) {
      let source: string | null = null;
      if (onHome && facts.description) source = facts.description;
      else if (onHome && facts.services.length) {
        const place = facts.locations[0] ?? facts.location;
        source = `${facts.name} provides ${facts.services.slice(0, 3).join(", ")}${place ? ` in ${place}` : ""}.`;
      } else if (!onHome && page.leadParagraph) source = page.leadParagraph;
      if (!source) {
        needsInfo.push(
          onHome
            ? "Home page meta description: add a company description (client profile) or verified services."
            : `Meta description for ${label}: the page has no paragraph to summarise; write one by hand.`,
        );
      } else {
        const proposed = clip(source, 155);
        fixes.push({
          ruleKey: "seo.meta_description",
          pageUrl: page.url,
          area: "seo",
          classification: "confirmed",
          priority: onHome ? "medium" : "low",
          title: `Write the meta description for the ${label}`,
          issue: !page.metaDescription
            ? `The ${label} has no meta description, so search engines pick a snippet themselves.`
            : dupDesc
              ? `The ${label} shares its meta description with other pages.`
              : `The ${label}'s meta description is ${descLen} characters (aim for ${DESCRIPTION_RANGE.min}–${DESCRIPTION_RANGE.max}).`,
          evidence: evidence(
            page,
            site,
            page.metaDescription
              ? `<meta name="description" content="${page.metaDescription}">`
              : 'No <meta name="description"> tag.',
          ),
          deliverable: { format: "text", parts: [{ label: "Meta description", value: proposed }] },
          location: `<meta name="description"> of ${page.url} (the SEO description field)`,
          instructions: steps(facts, "title_meta"),
          benefit: "A clear summary under the title improves how the search result reads.",
          dependencies: [],
          uncertainty:
            "Search engines may still rewrite snippets; the description is a strong hint, not a guarantee.",
          check: { type: "meta_description_is" },
          verificationMethod: `Re-fetch ${page.url} and confirm the meta description is exactly the approved text.`,
          rollback: page.metaDescription
            ? `Restore the description "${page.metaDescription}".`
            : "Remove the meta description.",
        });
      }
    }

    // ── H1 ─────────────────────────────────────────────────────────────────────
    if (page.h1.length === 0) {
      const topic = onHome ? homeTopic(facts) : pageTopic(page, facts);
      if (!topic) {
        needsInfo.push("Home page H1: add the client's main service as a verified Brain fact.");
      } else {
        fixes.push({
          ruleKey: "seo.h1_missing",
          pageUrl: page.url,
          area: "seo",
          classification: "confirmed",
          priority: onHome ? "high" : "medium",
          title: `Add a main heading (H1) to the ${label}`,
          issue: `The ${label} has no H1, so there is no single statement of what the page is about.`,
          evidence: evidence(page, site, "No <h1> element on the page."),
          deliverable: { format: "text", parts: [{ label: "H1", value: topic }] },
          location: `Top of the main content on ${page.url}, as the first heading (format the existing headline as Heading 1 if there is one).`,
          instructions: steps(facts, "page_content"),
          benefit:
            "One clear H1 helps search engines and assistive technology understand the page.",
          dependencies: [],
          check: { type: "h1_is" },
          verificationMethod: `Re-fetch ${page.url} and confirm there is exactly one H1 with the approved text.`,
          rollback: "Change the heading back to its previous style.",
        });
      }
    } else if (page.h1.length > 1) {
      fixes.push({
        ruleKey: "seo.h1_multiple",
        pageUrl: page.url,
        area: "seo",
        classification: "confirmed",
        priority: "low",
        title: `Keep one H1 on the ${label}`,
        issue: `The ${label} has ${page.h1.length} H1 headings, which blurs what the page is about.`,
        evidence: evidence(page, site, page.h1.map((h) => `<h1>${h}</h1>`).join(" ")),
        deliverable: {
          format: "text",
          parts: [
            { label: "Keep as H1", value: page.h1[0] },
            { label: "Change to H2", value: page.h1.slice(1).join("\n") },
          ],
        },
        location: `Headings on ${page.url}`,
        instructions: steps(facts, "page_content"),
        benefit: "A single H1 with H2 sub-headings gives the page a clear outline.",
        dependencies: [],
        check: { type: "single_h1" },
        verificationMethod: `Re-fetch ${page.url} and confirm exactly one H1 remains.`,
        rollback: "Set the changed headings back to Heading 1.",
      });
    }

    // ── Canonical ─────────────────────────────────────────────────────────────
    if (!page.canonical) {
      const clean = new URL(page.url);
      clean.search = "";
      clean.hash = "";
      fixes.push({
        ruleKey: "technical.canonical",
        pageUrl: page.url,
        area: "technical",
        classification: "improvement",
        priority: "low",
        title: `Add a canonical URL to the ${label}`,
        issue: `The ${label} doesn't declare its preferred URL, so variants (with tracking parameters or trailing slashes) can compete with each other.`,
        evidence: evidence(page, site, 'No <link rel="canonical"> tag.'),
        deliverable: {
          format: "html",
          parts: [{ label: "Canonical tag", value: `<link rel="canonical" href="${clean.href}">` }],
        },
        location: `<head> of ${page.url}`,
        instructions: steps(facts, "head_code"),
        benefit: "Consolidates ranking signals on one URL.",
        dependencies: [],
        check: { type: "canonical_present" },
        verificationMethod: `Re-fetch ${page.url} and confirm a canonical link is present.`,
        rollback: "Remove the canonical tag.",
      });
    }

    // ── Image alt text ────────────────────────────────────────────────────────
    if (page.imagesMissingAlt.length > 0) {
      fixes.push({
        ruleKey: "seo.alt_text",
        pageUrl: page.url,
        area: "seo",
        classification: "confirmed",
        priority: "low",
        title: `Describe ${page.imagesMissingAlt.length} image(s) on the ${label}`,
        issue: `${page.imagesMissingAlt.length} of ${page.imageCount} images on the ${label} have no meaningful alt text.`,
        evidence: evidence(page, site, page.imagesMissingAlt.join("\n")),
        deliverable: {
          format: "text",
          parts: [
            {
              label:
                "Images to describe (one line each: what the image shows, under 125 characters)",
              value: page.imagesMissingAlt.join("\n"),
            },
          ],
        },
        location: `The image settings (alt text field) of each image listed, on ${page.url}`,
        instructions: steps(facts, "page_content"),
        benefit: "Screen-reader users can understand the images, and image search can index them.",
        dependencies: [
          "Someone who can see the images writes each description. We don't guess image content.",
        ],
        check: { type: "alt_text_complete" },
        verificationMethod: `Re-fetch ${page.url} and confirm every image has alt text.`,
        rollback: "Clear the alt text fields.",
      });
    }
  }

  // ── Site-wide (checked on the home page) ─────────────────────────────────────
  if (!home.lang) {
    const lang = langFor(facts.country);
    fixes.push({
      ruleKey: "technical.lang",
      pageUrl: home.url,
      area: "technical",
      classification: "confirmed",
      priority: "low",
      title: "Declare the site language",
      issue:
        "The <html> element has no lang attribute, so browsers, screen readers and engines must guess the language.",
      evidence: evidence(home, site, "<html> without a lang attribute."),
      deliverable: {
        format: "html",
        parts: [{ label: "Attribute", value: `<html lang="${lang}">` }],
      },
      location: "The <html> element of the site template (applies to every page).",
      instructions: steps(facts, "page_language"),
      benefit: "Correct pronunciation by screen readers and clearer language targeting.",
      dependencies: [],
      check: { type: "lang_present" },
      verificationMethod: `Re-fetch ${home.url} and confirm <html> has a lang attribute.`,
      rollback: "Remove the lang attribute.",
    });
  }

  if (!home.viewport) {
    fixes.push({
      ruleKey: "technical.viewport",
      pageUrl: home.url,
      area: "technical",
      classification: "confirmed",
      priority: "high",
      title: "Make the site render properly on phones",
      issue: "The site has no viewport meta tag, so phones show a shrunken desktop page.",
      evidence: evidence(home, site, 'No <meta name="viewport"> tag.'),
      deliverable: {
        format: "html",
        parts: [
          {
            label: "Viewport tag",
            value: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          },
        ],
      },
      location: "<head> of the site template (every page).",
      instructions: steps(facts, "head_code"),
      benefit:
        "Google indexes the mobile version of pages; an unreadable mobile page hurts search and conversions.",
      dependencies: [
        "Check the layout on a phone after adding it; old fixed-width layouts may need CSS work.",
      ],
      check: { type: "viewport_present" },
      verificationMethod: `Re-fetch ${home.url} and confirm the viewport tag is present.`,
      rollback: "Remove the viewport tag.",
    });
  }

  const hasOrg = site.pages.some((p) => p.jsonLdTypes.some((t) => ORG_TYPES.includes(t)));
  if (!hasOrg) {
    const place = facts.locations[0] ?? facts.location;
    const sameAs = [
      ...new Set([facts.linkedinUrl, ...Object.values(home.socialProfiles)].filter(Boolean)),
    ] as string[];
    const org: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: facts.name,
      url: `${site.origin}/`,
    };
    if (facts.description) org.description = clip(facts.description, 300);
    if (facts.phone) org.telephone = telHref(facts.phone, facts.country);
    if (facts.email) org.email = facts.email;
    if (place)
      org.address = {
        "@type": "PostalAddress",
        addressLocality: place,
        addressCountry: facts.country,
      };
    if (sameAs.length) org.sameAs = sameAs;
    const deps = ['Add "logo" with the URL of the logo image once confirmed.'];
    if (!facts.description)
      deps.push("Add a company description to the client profile to include it.");
    fixes.push({
      ruleKey: "geo.organization_schema",
      pageUrl: home.url,
      area: "geo",
      classification: "confirmed",
      priority: "high",
      title: "Publish who the business is as structured data",
      issue:
        "No page states the organisation's identity in structured data (Organization schema), so search engines and AI assistants have to infer the name, location and profiles.",
      evidence: evidence(
        home,
        site,
        `Structured data types found: ${[...new Set(site.pages.flatMap((p) => p.jsonLdTypes))].join(", ") || "none"} across ${site.pages.length} page(s).`,
      ),
      deliverable: {
        format: "json-ld",
        parts: [
          {
            label: "Organization JSON-LD",
            value: `<script type="application/ld+json">\n${JSON.stringify(org, null, 2)}\n</script>`,
          },
        ],
      },
      location: `<head> of ${home.url} (site-wide is fine).`,
      instructions: steps(facts, "structured_data"),
      benefit:
        "Gives search engines and AI assistants an unambiguous, machine-readable statement of the business entity and its official profiles.",
      dependencies: deps,
      uncertainty:
        "Structured data is a signal engines may use, not a guarantee of rich results or AI citations.",
      check: { type: "jsonld_type", anyOf: ORG_TYPES },
      verificationMethod: `Re-fetch ${home.url} and confirm Organization structured data is present; then run it through Google's Rich Results Test.`,
      rollback: "Remove the JSON-LD script block.",
    });
  }

  const ogMissing = ["title", "description", "url", "type"].filter((k) => !home.openGraph[k]);
  if (ogMissing.includes("title") || ogMissing.includes("description")) {
    const title = home.title ?? facts.name;
    const desc = home.metaDescription ?? facts.description;
    if (desc) {
      const tags = [
        `<meta property="og:type" content="website">`,
        `<meta property="og:url" content="${home.url}">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(clip(desc, 200))}">`,
        `<meta property="og:site_name" content="${escapeHtml(facts.name)}">`,
      ];
      fixes.push({
        ruleKey: "seo.open_graph",
        pageUrl: home.url,
        area: "seo",
        classification: "confirmed",
        priority: "medium",
        title: "Add social sharing tags to the home page",
        issue: `Links to the home page shared on LinkedIn, WhatsApp and other apps have no defined ${ogMissing.map((k) => `og:${k}`).join(", ")}.`,
        evidence: evidence(
          home,
          site,
          `Open Graph tags present: ${
            Object.keys(home.openGraph)
              .map((k) => `og:${k}`)
              .join(", ") || "none"
          }.`,
        ),
        deliverable: {
          format: "html",
          parts: [{ label: "Open Graph tags", value: tags.join("\n") }],
        },
        location: `<head> of ${home.url}`,
        instructions: steps(facts, "head_code"),
        benefit:
          "Shared links show a proper title and summary instead of whatever the app guesses.",
        dependencies: home.openGraph.image
          ? []
          : ['Choose a 1200×630 px share image and add <meta property="og:image" content="…">.'],
        uncertainty: home.metaDescription
          ? undefined
          : "Uses the profile description; update it if the meta description fix changes.",
        check: { type: "open_graph", keys: ["title", "description"] },
        verificationMethod: `Re-fetch ${home.url} and confirm og:title and og:description are present; preview with LinkedIn's Post Inspector.`,
        rollback: "Remove the added Open Graph tags.",
      });
    }
  }

  if (facts.phone && site.pages.every((p) => p.phoneLinks === 0)) {
    const href = telHref(facts.phone, facts.country);
    fixes.push({
      ruleKey: "conversion.phone_link",
      pageUrl: home.url,
      area: "conversion",
      classification: "improvement",
      priority: "medium",
      title: "Make the phone number tappable",
      issue: `None of the ${site.pages.length} pages read has a tap-to-call link, so mobile visitors have to copy the number by hand.`,
      evidence: evidence(home, site, `0 tel: links across ${site.pages.length} page(s).`),
      deliverable: {
        format: "html",
        parts: [{ label: "Link", value: `<a href="tel:${href}">${escapeHtml(facts.phone)}</a>` }],
      },
      location:
        "Wherever the phone number appears as plain text (typically the header and footer contact block).",
      instructions: steps(facts, "page_content"),
      benefit: "Removes a step for mobile visitors who want to call.",
      dependencies: [],
      check: { type: "phone_link" },
      verificationMethod: `Re-fetch ${home.url} and confirm at least one tel: link.`,
      rollback: "Replace the link with the plain-text number.",
    });
  }

  // ── Site files ──────────────────────────────────────────────────────────────
  if (!site.sitemap.found) {
    const urls = site.pages.map((p) => `  <url><loc>${escapeHtml(p.url)}</loc></url>`).join("\n");
    fixes.push({
      ruleKey: "technical.sitemap",
      pageUrl: `${site.origin}/sitemap.xml`,
      area: "technical",
      classification: "confirmed",
      priority: "medium",
      title: "Publish an XML sitemap",
      issue: "No XML sitemap was found (checked robots.txt, /sitemap.xml and /sitemap_index.xml).",
      evidence: [
        {
          source: `Fetch of ${site.origin}/sitemap.xml`,
          observed: "Not found or not XML.",
          collectedAt: site.collectedAt,
        },
      ],
      deliverable: {
        format: "file",
        parts:
          facts.cms === "custom" || facts.cms === "unknown"
            ? [
                {
                  label: "sitemap.xml (the pages we read; add any others)",
                  value: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
                },
              ]
            : [
                {
                  label: "Setting",
                  value: "Turn on the platform's built-in sitemap (steps below).",
                },
              ],
      },
      location: `${site.origin}/sitemap.xml`,
      instructions: steps(facts, "sitemap"),
      benefit: "Helps search engines discover every page and notice updates.",
      dependencies: ["Submit the sitemap in Google Search Console once it is live."],
      uncertainty:
        facts.cms === "custom" || facts.cms === "unknown"
          ? `Lists only the ${site.pages.length} page(s) we read; a generated sitemap is better long term.`
          : undefined,
      check: { type: "sitemap_found" },
      verificationMethod: "Re-fetch the site files and confirm an XML sitemap is found.",
      rollback: "Remove the sitemap file or turn the setting off.",
    });
  }

  if (!site.robotsTxt.found || (site.sitemap.found && site.robotsTxt.sitemaps.length === 0)) {
    const sitemapUrl = site.sitemap.url ?? `${site.origin}/sitemap.xml`;
    const whole = !site.robotsTxt.found;
    fixes.push({
      ruleKey: "technical.robots_sitemap",
      pageUrl: `${site.origin}/robots.txt`,
      area: "technical",
      classification: "improvement",
      priority: "low",
      title: whole ? "Publish a robots.txt file" : "List the sitemap in robots.txt",
      issue: whole
        ? "The site has no robots.txt, so crawlers get no pointer to the sitemap."
        : "robots.txt exists but doesn't list the sitemap.",
      evidence: [
        {
          source: `Fetch of ${site.origin}/robots.txt`,
          observed: whole ? "Not found." : "No Sitemap: line.",
          collectedAt: site.collectedAt,
        },
      ],
      deliverable: {
        format: "file",
        parts: [
          whole
            ? { label: "robots.txt", value: `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}` }
            : { label: "Add this line", value: `Sitemap: ${sitemapUrl}` },
        ],
      },
      location: `${site.origin}/robots.txt`,
      instructions: steps(facts, "robots_file"),
      benefit: "Points every crawler, including AI crawlers, at the full list of pages.",
      dependencies: site.sitemap.found ? [] : ["Publish the sitemap first (separate fix)."],
      check: { type: "robots_sitemap" },
      verificationMethod: "Re-fetch robots.txt and confirm it lists a sitemap.",
      rollback: whole ? "Delete robots.txt." : "Remove the Sitemap line.",
    });
  }

  if (!site.llmsTxt) {
    const pages = site.pages
      .filter((p) => p.title)
      .map((p) => `- [${pageTopic(p, facts) || p.title}](${p.url})`);
    const lines = [`# ${facts.name}`, ""];
    if (facts.description) lines.push(`> ${clip(facts.description, 300)}`, "");
    if (facts.services.length)
      lines.push("## Services", ...facts.services.map((s) => `- ${s}`), "");
    if (pages.length) lines.push("## Key pages", ...pages, "");
    const contact = [
      facts.email && `- Email: ${facts.email}`,
      facts.phone && `- Phone: ${facts.phone}`,
    ].filter(Boolean) as string[];
    if (contact.length) lines.push("## Contact", ...contact, "");
    if (!facts.description && !facts.services.length) {
      needsInfo.push("llms.txt: add a company description or verified services first.");
    } else {
      fixes.push({
        ruleKey: "geo.llms_txt",
        pageUrl: `${site.origin}/llms.txt`,
        area: "geo",
        classification: "hypothesis",
        priority: "low",
        title: "Publish an llms.txt summary for AI tools",
        issue:
          "The site has no llms.txt, a plain-text summary some AI tools read to understand a site.",
        evidence: [
          {
            source: `Fetch of ${site.origin}/llms.txt`,
            observed: "Not found.",
            collectedAt: site.collectedAt,
          },
        ],
        deliverable: {
          format: "file",
          parts: [{ label: "llms.txt", value: lines.join("\n").trim() }],
        },
        location: `${site.origin}/llms.txt`,
        instructions: steps(facts, "root_file"),
        benefit: "A concise, accurate summary of the business for tools that look for it.",
        dependencies: [],
        uncertainty:
          "llms.txt is a proposed convention; major AI search engines have not committed to using it. Low effort, uncertain effect: treat it as a test.",
        check: { type: "llms_txt" },
        verificationMethod: `Fetch ${site.origin}/llms.txt and confirm it is served as text.`,
        rollback: "Delete the file.",
      });
    }
  }

  // ── Answer readiness (AEO) ────────────────────────────────────────────────────
  if (site.pages.every((p) => p.questionHeadings.length < 2)) {
    const place = facts.locations.length ? facts.locations.join(", ") : facts.location;
    const qa: { q: string; a: string }[] = [];
    if (facts.description)
      qa.push({ q: `What does ${facts.name} do?`, a: clip(facts.description, 320) });
    if (facts.services.length)
      qa.push({
        q: `What services does ${facts.name} offer?`,
        a: `${facts.name} offers ${facts.services.join(", ")}.`,
      });
    if (place)
      qa.push({
        q: `Where does ${facts.name} work?`,
        a: `${facts.name} serves clients in ${place}.`,
      });
    const contact = [
      facts.phone && `call ${facts.phone}`,
      facts.email && `email ${facts.email}`,
    ].filter(Boolean);
    if (contact.length)
      qa.push({ q: `How do I contact ${facts.name}?`, a: `You can ${contact.join(" or ")}.` });
    if (qa.length < 2) {
      needsInfo.push(
        "FAQ section: needs at least two verified facts (description, services, location, contact).",
      );
    } else {
      const html = [
        "<section>",
        "  <h2>Frequently asked questions</h2>",
        ...qa.flatMap(({ q, a }) => [`  <h3>${escapeHtml(q)}</h3>`, `  <p>${escapeHtml(a)}</p>`]),
        "</section>",
      ].join("\n");
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: qa.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      };
      fixes.push({
        ruleKey: "aeo.faq",
        pageUrl: home.url,
        area: "aeo",
        classification: "improvement",
        priority: "medium",
        title: "Add answer-ready FAQs to the home page",
        issue: `None of the ${site.pages.length} pages read answers questions directly (fewer than two question-style headings on every page).`,
        evidence: evidence(
          home,
          site,
          site.pages
            .map((p) => `${pathOf(p.url)}: ${p.questionHeadings.length} question heading(s)`)
            .join("\n"),
        ),
        deliverable: {
          format: "html",
          parts: [
            { label: "FAQ section", value: html },
            {
              label: "FAQPage JSON-LD",
              value: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`,
            },
          ],
        },
        location: `${home.url}: a new section just above the footer. The JSON-LD goes in the same page's <head>.`,
        instructions: [...steps(facts, "page_content"), ...steps(facts, "structured_data")],
        benefit:
          "Short, direct answers in question form are the format answer engines and AI assistants quote.",
        dependencies: [
          "Add questions customers actually ask (sales calls, emails, Search Console queries) over time.",
        ],
        uncertainty:
          "Answers use only verified profile facts. Google shows FAQ rich results only for a few authoritative sites, so the value is answer-ready content, not a search feature.",
        check: { type: "question_headings", min: 2 },
        verificationMethod: `Re-fetch ${home.url} and confirm at least two question headings.`,
        rollback: "Remove the FAQ section and its JSON-LD.",
      });
    }
  }

  return { fixes, needsInfo: [...new Set(needsInfo)] };
}
