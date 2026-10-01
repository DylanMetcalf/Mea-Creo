import { type HTMLElement, parse } from "node-html-parser";
import type { DecisionMaker, ProspectResearch } from "@/db/schema";
import { extractPageSignals } from "@/modules/audits/parse";

/**
 * Pure extraction of company facts from a prospect's own public web pages. Everything
 * here is something the business publishes about itself; each person found records the
 * page it came from. Nothing is guessed: if a fact isn't on the page it stays empty.
 */

const ROLE_PATTERN =
  /\b(owner|founder|co-founder|director|managing director|md|ceo|chief [a-z]+ officer|c[eofmt]o|general manager|gm|head of [a-z ]+|[a-z]+ manager|partner|principal|chairman|chairperson|president|vice president|vp [a-z]+)\b/i;
const NAME_PATTERN =
  /^(?:(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+)?[A-Z][a-zA-Z'’-]+(?:\s+(?:van|von|de|der|du|le|la|[A-Z][a-zA-Z'’-]+)){1,3}$/;
const NOT_NAMES =
  /\b(our|the|team|meet|about|contact|services|company|group|limited|ltd|pty|solutions|engineering|mining|management|leadership|board|read|more|view|profile|privacy|policy|home|news)\b/i;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// South African numbers: +27 / 0 followed by 9 digits, with common separators.
const PHONE_PATTERN = /(?:\+27|\b0)[\s(-]*\d{2}[\s)-]*\d{3}[\s-]*\d{4}\b/g;

const SA_PLACES = [
  "Johannesburg",
  "Pretoria",
  "Centurion",
  "Midrand",
  "Sandton",
  "Cape Town",
  "Stellenbosch",
  "Durban",
  "Pietermaritzburg",
  "Gqeberha",
  "Port Elizabeth",
  "East London",
  "Bloemfontein",
  "Kimberley",
  "Polokwane",
  "Mbombela",
  "Nelspruit",
  "Emalahleni",
  "Witbank",
  "Middelburg",
  "Secunda",
  "Rustenburg",
  "Mahikeng",
  "Klerksdorp",
  "Potchefstroom",
  "Vereeniging",
  "Kempton Park",
  "Boksburg",
  "Germiston",
  "Richards Bay",
  "George",
  "Lydenburg",
  "Mashishing",
  "Dullstroom",
  "Steelpoort",
  "Burgersfort",
  "Phalaborwa",
  "Lephalale",
  "Kathu",
  "Sasolburg",
  "Welkom",
];

const JUNK_EMAIL =
  /\.(png|jpe?g|gif|webp|svg)$|@(example|sentry|wixpress|domain)\.|^(name|email|your)@/i;

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("27")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+27${digits.slice(1)}`
      : digits;
}

function lines(root: HTMLElement, dropChrome = false): string[] {
  const body = root.querySelector("body") ?? root;
  const drop = dropChrome
    ? "script, style, noscript, svg, nav, footer, form"
    : "script, style, noscript, svg";
  for (const el of body.querySelectorAll(drop)) el.remove();
  return body.structuredText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanName(s: string): string | null {
  const name = s.replace(/[,–—|:-]+$/, "").trim();
  if (name.length > 40 || !NAME_PATTERN.test(name) || NOT_NAMES.test(name)) return null;
  return name;
}

function cleanRole(s: string): string | null {
  const role = s.trim();
  return role.length <= 60 && ROLE_PATTERN.test(role) ? role : null;
}

/** People named with a role on a page: JSON-LD Person, "Name – Role" lines, or name/role pairs. */
export function extractPeople(html: string, pageUrl: string): DecisionMaker[] {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const found = new Map<string, DecisionMaker>();
  const add = (name: string | null, role: string | null, extra: Partial<DecisionMaker> = {}) => {
    if (!name || !role) return;
    const key = name.toLowerCase();
    if (!found.has(key)) found.set(key, { name, role, source: pageUrl, ...extra });
  };

  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const nodes: Record<string, unknown>[] = (Array.isArray(data) ? data : [data]).flatMap(
        (n: Record<string, unknown>) =>
          Array.isArray(n["@graph"]) ? (n["@graph"] as Record<string, unknown>[]) : [n],
      );
      for (const n of nodes) {
        const people = [n, ...(Array.isArray(n.employee) ? n.employee : []), n.founder].filter(
          Boolean,
        ) as Record<string, unknown>[];
        for (const p of people)
          if (String(p["@type"]) === "Person" && typeof p.name === "string")
            add(cleanName(p.name), typeof p.jobTitle === "string" ? cleanRole(p.jobTitle) : null);
      }
    } catch {
      // Ignore invalid JSON-LD.
    }
  }

  const ls = lines(root, true);
  for (let i = 0; i < ls.length; i++) {
    const inline = ls[i].match(/^(.{4,40}?)\s*[,–—|:-]\s+(.{2,60})$/);
    if (inline) add(cleanName(inline[1]), cleanRole(inline[2]));
    const name = cleanName(ls[i]);
    if (name) add(name, cleanRole(ls[i + 1] ?? "") ?? cleanRole(ls[i - 1] ?? ""));
  }

  // LinkedIn profile links near a person's name.
  for (const a of root.querySelectorAll('a[href*="linkedin.com/in/"]')) {
    const container = a.parentNode?.parentNode as HTMLElement | undefined;
    const t = container?.textContent ?? "";
    for (const p of found.values())
      if (!p.linkedinUrl && t.includes(p.name)) p.linkedinUrl = a.getAttribute("href");
  }
  return [...found.values()].slice(0, 12);
}

export interface FetchedDoc {
  url: string;
  html: string;
}

/** Combines what the home page and the about/team/contact/services pages say. */
export function buildResearch(pages: FetchedDoc[], notes: string[] = []): ProspectResearch {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const services = new Set<string>();
  const locations = new Set<string>();
  const people = new Map<string, DecisionMaker>();
  const social: ProspectResearch["social"] = {};
  let description: string | undefined;
  let hasBooking = false;
  let hasContactForm = false;
  let ctas = 0;
  let hasCaseStudies = false;
  let hasBlog = false;
  let ecommerce = false;
  let branchWords = false;
  const paths = new Set<string>();

  for (const page of pages) {
    const s = extractPageSignals(page.html, page.url);
    const root = parse(page.html, { comment: false });
    const pathname = new URL(page.url).pathname.toLowerCase();
    description ??= s.metaDescription ?? s.openGraph.description;
    for (const p of s.internalPaths) paths.add(p);
    for (const [k, v] of Object.entries(s.socialProfiles))
      if (
        k in { linkedin: 1, facebook: 1, instagram: 1, youtube: 1, x: 1 } &&
        !social[k as keyof typeof social]
      )
        social[k as keyof typeof social] = v;

    for (const a of root.querySelectorAll('a[href^="mailto:"]')) {
      const e = (a.getAttribute("href") ?? "").slice(7).split("?")[0].trim().toLowerCase();
      if (e && !JUNK_EMAIL.test(e)) emails.add(e);
    }
    for (const a of root.querySelectorAll('a[href^="tel:"]'))
      phones.add(normalisePhone(a.getAttribute("href")!.slice(4)));
    const bodyText = lines(parse(page.html, { comment: false })).join("\n");
    for (const e of bodyText.match(EMAIL_PATTERN) ?? [])
      if (!JUNK_EMAIL.test(e)) emails.add(e.toLowerCase());
    for (const p of bodyText.match(PHONE_PATTERN) ?? []) phones.add(normalisePhone(p));
    for (const place of SA_PLACES)
      if (new RegExp(`\\b${place}\\b`).test(bodyText)) locations.add(place);
    if (/\b(branches|our offices|locations|regional offices)\b/i.test(bodyText)) branchWords = true;

    if (
      /services|what-we-do|solutions|capabilit|products|expertise/.test(pathname) ||
      pathname === "/"
    ) {
      for (const h of root.querySelectorAll("h2, h3")) {
        const t = h.textContent.replace(/\s+/g, " ").trim();
        if (
          t.length >= 4 &&
          t.length <= 60 &&
          !t.endsWith("?") &&
          !/contact|about|news|testimonial|why|our team|get in touch|welcome/i.test(t)
        )
          services.add(t);
      }
    }
    for (const p of extractPeople(page.html, page.url))
      if (!people.has(p.name.toLowerCase())) people.set(p.name.toLowerCase(), p);

    if (
      /calendly|book (a|an|your) (call|meeting|consultation|appointment)|appointments?/i.test(
        page.html,
      )
    )
      hasBooking = true;
    if (s.forms > 0 && /contact|enquir|quote|get-in-touch/.test(pathname)) hasContactForm = true;
    if (s.forms > 0 && pathname === "/" && s.ctaTexts.length) hasContactForm = true;
    ctas += s.ctaTexts.length;
    if (s.caseStudyOrTestimonialSignals.some((t) => t === "case studies" || t === "testimonials"))
      hasCaseStudies = true;
    if (s.blogPage) hasBlog = true;
    if (/woocommerce|shopify|add[- ]to[- ]cart|\/cart\b|\/checkout\b/i.test(page.html))
      ecommerce = true;
  }

  return {
    researchedAt: new Date().toISOString(),
    pagesRead: pages.map((p) => p.url),
    description,
    services: [...services].slice(0, 12),
    locations: [...locations].slice(0, 8),
    emails: [...emails].slice(0, 10),
    phones: [...phones].slice(0, 6),
    social,
    decisionMakers: [...people.values()].slice(0, 12),
    signals: {
      hasBooking,
      hasContactForm,
      hasClearCta: ctas > 0,
      hasCaseStudies,
      hasBlog,
      approxPages: paths.size || undefined,
      multipleLocations: locations.size >= 2 || branchWords,
      ecommerce,
    },
    notes,
  };
}

const PAGE_PRIORITY: [RegExp, number][] = [
  [/^\/(about|about-us|who-we-are|our-story|company)\/?$/, 1],
  [/^\/(team|our-team|people|leadership|management|our-people|meet-the-team)\/?$/, 0],
  [/^\/(contact|contact-us|get-in-touch)\/?$/, 2],
  [/^\/(services|our-services|what-we-do|solutions|capabilities|products)\/?$/, 3],
  [/(team|leadership|management|people|about|contact)/, 4],
];

/** The most useful internal pages to read after the home page (max `limit`). */
export function pickResearchPages(internalPaths: string[], limit = 5): string[] {
  const scored = internalPaths
    .map((p) => ({ p, rank: PAGE_PRIORITY.find(([re]) => re.test(p))?.[1] }))
    .filter((x): x is { p: string; rank: number } => x.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.p.length - b.p.length);
  return [...new Set(scored.map((x) => x.p))].slice(0, limit);
}
