import { type HTMLElement, parse } from "node-html-parser";
import type { AuditSignals } from "./types";

const SOCIAL_HOSTS: Record<string, RegExp> = {
  linkedin: /(^|\.)linkedin\.com$/,
  facebook: /(^|\.)facebook\.com$/,
  instagram: /(^|\.)instagram\.com$/,
  x: /(^|\.)(twitter|x)\.com$/,
  youtube: /(^|\.)youtube\.com$/,
  tiktok: /(^|\.)tiktok\.com$/,
};

const CTA_PATTERN =
  /\b(contact|book|call|quote|get started|enquire|enquiry|request|talk to|schedule|demo|consultation|get in touch|free)\b/i;
const TRUST_PATTERNS: [RegExp, string][] = [
  [/testimonial/i, "testimonials"],
  [/case stud(y|ies)/i, "case studies"],
  [/\breviews?\b/i, "reviews"],
  [/\b(certified|accredited|iso \d{4,5}|b-bbee|bbbee)\b/i, "certifications/accreditation"],
  [/\b(our clients|trusted by|clients include)\b/i, "client references"],
  [/\b(award|awarded)\b/i, "awards"],
];
const ANALYTICS_PATTERNS: [RegExp, string][] = [
  [/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/, "Google Tag Manager"],
  [/gtag\(|googletagmanager\.com\/gtag\/js|G-[A-Z0-9]{6,}/, "Google Analytics 4"],
  [/plausible\.io/, "Plausible"],
  [/clarity\.ms/, "Microsoft Clarity"],
  [/hotjar/i, "Hotjar"],
  [/connect\.facebook\.net|fbq\(/, "Meta Pixel"],
  [/snap\.licdn\.com|_linkedin_partner_id/, "LinkedIn Insight Tag"],
];
const ADDRESS_PATTERN =
  /\b(street|st\.|road|rd\.|avenue|ave\.|drive|park|suite|unit|building|floor)\b[^<]{0,60}\b\d{4}\b|\b\d{4}\b[^<]{0,20}(south africa|gauteng|western cape|kwazulu)/i;

function text(el: HTMLElement | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function safeUrl(href: string, base: URL): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

function collectJsonLd(root: HTMLElement): { types: string[]; nodes: Record<string, unknown>[] } {
  const nodes: Record<string, unknown>[] = [];
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent);
      const queue: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) queue.push(...(obj["@graph"] as unknown[]));
        if (obj["@type"]) nodes.push(obj);
      }
    } catch {
      // Invalid JSON-LD is itself a finding; the node is simply not counted.
    }
  }
  const types = nodes.flatMap((n) =>
    Array.isArray(n["@type"]) ? (n["@type"] as string[]) : [String(n["@type"])],
  );
  return { types: [...new Set(types)], nodes };
}

/** Pure extraction of visibility signals from one HTML document. */
export function extractPageSignals(html: string, pageUrl: string) {
  const base = new URL(pageUrl);
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: false },
  });
  const head = root.querySelector("head");
  const meta = (selector: string) =>
    root.querySelector(selector)?.getAttribute("content")?.trim() || undefined;

  const openGraph: Record<string, string> = {};
  for (const el of root.querySelectorAll('meta[property^="og:"]')) {
    const key = el.getAttribute("property")?.slice(3);
    const value = el.getAttribute("content");
    if (key && value) openGraph[key] = value;
  }

  const { types, nodes } = collectJsonLd(root);
  const org = nodes.find((n) => {
    const t = Array.isArray(n["@type"]) ? (n["@type"] as string[]) : [String(n["@type"])];
    return t.some((x) => /Organization|LocalBusiness|ProfessionalService|Corporation/.test(x));
  });
  const sameAs = org?.sameAs
    ? Array.isArray(org.sameAs)
      ? (org.sameAs as string[])
      : [String(org.sameAs)]
    : [];

  // Body text without scripts/styles/nav noise.
  const body = root.querySelector("body") ?? root;
  for (const el of body.querySelectorAll("script, style, noscript, svg")) el.remove();
  const bodyText = text(body);
  const wordCount = bodyText ? bodyText.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length : 0;

  const h1 = root.querySelectorAll("h1").map(text).filter(Boolean);
  const h2 = root.querySelectorAll("h2").map(text).filter(Boolean);
  const questionHeadings = root
    .querySelectorAll("h2, h3, h4, summary, dt")
    .map(text)
    .filter((t) => t.endsWith("?") && t.length < 160);

  const images = root.querySelectorAll("img");
  const imagesMissingAlt = images.filter((img) => {
    const alt = img.getAttribute("alt");
    return alt === undefined || alt.trim() === "" || /\.(jpe?g|png|webp|gif)$/i.test(alt.trim());
  }).length;

  let internalLinks = 0;
  let externalLinks = 0;
  let phoneLinks = 0;
  let emailLinks = 0;
  let googleMaps = false;
  const socialProfiles: Record<string, string> = {};
  const internalPaths = new Set<string>();
  const ctaTexts = new Set<string>();

  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("tel:")) phoneLinks++;
    else if (href.startsWith("mailto:")) emailLinks++;
    const url = safeUrl(href, base);
    if (url && /^https?:$/.test(url.protocol)) {
      if (url.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) {
        internalLinks++;
        internalPaths.add(url.pathname.toLowerCase());
      } else {
        externalLinks++;
        if (/google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/.test(url.href))
          googleMaps = true;
        for (const [name, pattern] of Object.entries(SOCIAL_HOSTS)) {
          if (pattern.test(url.hostname) && !socialProfiles[name]) socialProfiles[name] = url.href;
        }
      }
    }
    const label = text(a);
    if (label && label.length < 40 && CTA_PATTERN.test(label)) ctaTexts.add(label);
  }
  for (const b of root.querySelectorAll("button")) {
    const label = text(b);
    if (label && label.length < 40 && CTA_PATTERN.test(label)) ctaTexts.add(label);
  }
  if (root.querySelector('iframe[src*="google.com/maps"]')) googleMaps = true;

  const hasPath = (pattern: RegExp) => [...internalPaths].some((p) => pattern.test(p));
  const lowerHtml = html.slice(0, 2_000_000);

  return {
    title: text(head?.querySelector("title") ?? root.querySelector("title")) || undefined,
    metaDescription: meta('meta[name="description"]'),
    lang: root.querySelector("html")?.getAttribute("lang") || undefined,
    viewport: Boolean(root.querySelector('meta[name="viewport"]')),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute("href") || undefined,
    robotsMeta: meta('meta[name="robots"]'),
    h1,
    h2,
    questionHeadings,
    wordCount,
    imageCount: images.length,
    imagesMissingAlt,
    internalLinks,
    externalLinks,
    jsonLdTypes: types,
    organizationSchema: {
      name: typeof org?.name === "string" ? org.name : undefined,
      sameAs,
      logo: Boolean(org?.logo),
      address: Boolean(org?.address),
    },
    openGraph,
    twitterCard: Boolean(root.querySelector('meta[name="twitter:card"]')),
    favicon: Boolean(
      root.querySelector(
        'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      ),
    ),
    analytics: ANALYTICS_PATTERNS.filter(([pattern]) => pattern.test(lowerHtml)).map(
      ([, name]) => name,
    ),
    phoneLinks,
    emailLinks,
    forms: root.querySelectorAll("form").length,
    ctaTexts: [...ctaTexts].slice(0, 12),
    contactPage: hasPath(/contact|get-in-touch|enquir/),
    aboutPage: hasPath(/about|who-we-are|our-story|team/),
    blogPage: hasPath(/blog|news|insights|articles|resources|knowledge/),
    caseStudyOrTestimonialSignals: TRUST_PATTERNS.filter(([pattern]) => pattern.test(bodyText)).map(
      ([, label]) => label,
    ),
    socialProfiles,
    googleMaps,
    address: ADDRESS_PATTERN.test(bodyText) || Boolean(org?.address),
    internalPaths: [...internalPaths],
  };
}

export type PageSignals = ReturnType<typeof extractPageSignals>;

export function parseRobotsTxt(body: string): AuditSignals["robotsTxt"] {
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  const sitemaps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.slice(8).trim());
  let inWildcard = false;
  let blocksAll = false;
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) inWildcard = line.slice(11).trim() === "*";
    else if (inWildcard && /^disallow:\s*\/\s*$/i.test(line)) blocksAll = true;
  }
  return { found: true, blocksAll, sitemaps };
}

export function countSitemapUrls(xml: string): number {
  return (xml.match(/<loc>/gi) ?? []).length;
}
