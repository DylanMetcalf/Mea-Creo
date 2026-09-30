import type { Fetcher } from "@/modules/audits/collect";
import type { FetchedPage } from "@/modules/audits/fetcher";

/**
 * Fictional demo websites (".example" domains never resolve). The real audit engine
 * analyses these fixtures offline, so demo reports are produced by the same code that
 * analyses real sites.
 */
interface FixtureSite {
  html: string;
  robots?: string;
  sitemap?: string;
  responseTimeMs: number;
}

const page = (opts: {
  title: string;
  description?: string;
  h1: string[];
  sections: { h2: string; body: string }[];
  schema?: object;
  links?: string[];
  extraHead?: string;
}) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>${opts.title}</title>
${opts.description ? `<meta name="description" content="${opts.description}">` : ""}
<meta name="viewport" content="width=device-width, initial-scale=1">
${opts.schema ? `<script type="application/ld+json">${JSON.stringify(opts.schema)}</script>` : ""}
${opts.extraHead ?? ""}
</head><body>
<nav>${(opts.links ?? []).map((l) => `<a href="${l.split("|")[0]}">${l.split("|")[1] ?? l}</a>`).join(" ")}</nav>
${opts.h1.map((h) => `<h1>${h}</h1>`).join("")}
${opts.sections.map((s) => `<section><h2>${s.h2}</h2><p>${s.body}</p></section>`).join("")}
<img src="/hero.jpg"><img src="/team.jpg" alt="IMG_2231.jpg"><img src="/plant.jpg" alt="Workshop floor">
</body></html>`;

const lorem = (sentence: string, times: number) =>
  Array.from({ length: times }, () => sentence).join(" ");

export const DEMO_FIXTURES: Record<string, FixtureSite> = {
  "https://acacia-legal.example/": {
    responseTimeMs: 1400,
    html: page({
      title: "Acacia Legal",
      h1: ["Welcome", "Acacia Legal Advisory"],
      sections: [
        {
          h2: "About us",
          body: lorem(
            "We are a boutique commercial law firm serving growing businesses with contracts, compliance and disputes.",
            8,
          ),
        },
      ],
      links: [
        "/about|About",
        "/contact|Contact us",
        "https://www.linkedin.com/in/acacia-partner|LinkedIn",
      ],
    }),
    robots: "User-agent: *\nAllow: /",
  },
  "https://bluecrane-logistics.example/": {
    responseTimeMs: 3900,
    html: page({
      title: "Blue Crane Logistics | Freight & Warehousing Johannesburg",
      description:
        "Freight forwarding, warehousing and cross-border logistics for manufacturers and distributors in Southern Africa.",
      h1: ["Freight and warehousing for Southern African manufacturers"],
      sections: [
        {
          h2: "Services",
          body: lorem(
            "Cross-border road freight, bonded warehousing, customs clearing and contract logistics for manufacturers.",
            12,
          ),
        },
        {
          h2: "Industries",
          body: lorem(
            "Automotive components, FMCG distribution, industrial equipment and agricultural inputs.",
            6,
          ),
        },
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Blue Crane Logistics",
        url: "https://bluecrane-logistics.example",
      },
      links: [
        "/services|Services",
        "/contact|Request a quote",
        "tel:+27110000000|Call us",
        "https://www.facebook.com/bluecrane|Facebook",
      ],
      extraHead: '<meta property="og:title" content="Blue Crane Logistics">',
    }),
    robots: "User-agent: *\nAllow: /\nSitemap: https://bluecrane-logistics.example/sitemap.xml",
    sitemap:
      "<urlset><url><loc>https://bluecrane-logistics.example/</loc></url><url><loc>https://bluecrane-logistics.example/services</loc></url></urlset>",
  },
  "https://summit-fire.example/": {
    responseTimeMs: 900,
    html: page({
      title: "Summit Fire Protection | Fire Suppression Systems Gauteng",
      description:
        "Design, installation and maintenance of fire detection and suppression systems for commercial and industrial buildings in Gauteng.",
      h1: ["Fire detection and suppression for commercial and industrial buildings"],
      sections: [
        {
          h2: "What we do",
          body: lorem(
            "SANS-compliant fire detection, gas suppression, sprinkler maintenance and annual inspections for warehouses, offices and factories.",
            14,
          ),
        },
        {
          h2: "Why clients choose us",
          body: lorem(
            "Certified technicians, documented inspections and a 24-hour call-out service.",
            6,
          ),
        },
        {
          h2: "Case studies",
          body: "Read how we upgraded suppression at a regional distribution centre.",
        },
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Summit Fire Protection",
        address: { "@type": "PostalAddress", addressLocality: "Midrand" },
        logo: "https://summit-fire.example/logo.png",
      },
      links: [
        "/about|About",
        "/blog|Insights",
        "/contact|Book a site assessment",
        "tel:+27100000000|Call",
        "https://www.linkedin.com/company/summit-fire-demo|LinkedIn",
      ],
      extraHead:
        '<meta property="og:title" content="Summit Fire Protection"><meta property="og:image" content="https://summit-fire.example/og.jpg"><link rel="icon" href="/favicon.ico"><link rel="canonical" href="https://summit-fire.example/"><script async src="https://www.googletagmanager.com/gtag/js?id=G-DEMO1234"></script>',
    }),
    robots: "User-agent: *\nAllow: /",
    sitemap:
      "<urlset>" +
      Array.from(
        { length: 18 },
        (_, i) => `<url><loc>https://summit-fire.example/p${i}</loc></url>`,
      ).join("") +
      "</urlset>",
  },
  "https://kloof-bistro.example/": {
    responseTimeMs: 2100,
    html: page({
      title: "Kloof Street Bistro",
      h1: ["Good food, good friends"],
      sections: [{ h2: "Menu", body: lorem("Seasonal plates and local wines.", 5) }],
      links: ["/menu|Menu", "/book|Book a table"],
    }),
  },
  "https://ridgeback-software.example/": {
    responseTimeMs: 700,
    html: page({
      title: "Ridgeback Software | Custom Business Software",
      description:
        "Custom software, integrations and internal tools for mid-sized South African companies.",
      h1: ["Custom software for growing businesses"],
      sections: [
        {
          h2: "How much does custom software cost?",
          body: lorem("It depends on scope; most projects start with a two-week discovery.", 6),
        },
        {
          h2: "How long does a project take?",
          body: lorem("Typical projects run eight to sixteen weeks.", 6),
        },
        {
          h2: "Do you support existing systems?",
          body: lorem("Yes, we integrate with ERP, CRM and accounting platforms.", 6),
        },
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Ridgeback Software",
        logo: "https://ridgeback-software.example/logo.svg",
        sameAs: ["https://www.linkedin.com/company/ridgeback-demo"],
      },
      links: [
        "/about|About",
        "/insights|Insights",
        "/contact|Talk to us",
        "https://www.linkedin.com/company/ridgeback-demo|LinkedIn",
      ],
      extraHead:
        '<link rel="icon" href="/favicon.ico"><link rel="canonical" href="https://ridgeback-software.example/"><script>gtag("config","G-DEMO9999")</script>',
    }),
    robots: "User-agent: *\nAllow: /\nSitemap: https://ridgeback-software.example/sitemap.xml",
    sitemap:
      "<urlset>" +
      Array.from(
        { length: 40 },
        (_, i) => `<url><loc>https://ridgeback-software.example/p${i}</loc></url>`,
      ).join("") +
      "</urlset>",
  },
  "https://harbourline-engineering.example/": {
    responseTimeMs: 1100,
    html: page({
      title: "Harbourline Engineering | Marine & Industrial Engineering Durban",
      description:
        "Marine and industrial engineering services in Durban: pump overhauls, fabrication, maintenance contracts and 24-hour breakdown support.",
      h1: ["Marine and industrial engineering in Durban"],
      sections: [
        {
          h2: "Services",
          body: lorem(
            "Pump and valve overhauls, steel fabrication, planned maintenance contracts and breakdown response for port and industrial clients.",
            14,
          ),
        },
        {
          h2: "How quickly can you respond to a breakdown?",
          body: lorem("Our standby team is available 24 hours a day within the Durban metro.", 5),
        },
        {
          h2: "Do you work outside Durban?",
          body: lorem("Yes, we support clients across KwaZulu-Natal and the Eastern Cape.", 5),
        },
        { h2: "Case studies", body: "See recent refurbishment projects for port operators." },
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Harbourline Engineering",
        logo: "https://harbourline-engineering.example/logo.png",
        sameAs: ["https://www.linkedin.com/company/harbourline-demo"],
        address: { "@type": "PostalAddress", addressLocality: "Durban" },
      },
      links: [
        "/about|About",
        "/insights|Insights",
        "/contact|Request a quote",
        "tel:+27310000000|Call",
        "https://www.linkedin.com/company/harbourline-demo|LinkedIn",
        "https://maps.google.com/?q=harbourline|Find us",
      ],
      extraHead:
        '<meta property="og:title" content="Harbourline Engineering"><meta property="og:image" content="https://harbourline-engineering.example/og.jpg"><link rel="icon" href="/favicon.ico"><link rel="canonical" href="https://harbourline-engineering.example/"><script async src="https://www.googletagmanager.com/gtag/js?id=G-DEMO5555"></script>',
    }),
    robots: "User-agent: *\nAllow: /\nSitemap: https://harbourline-engineering.example/sitemap.xml",
    sitemap:
      "<urlset>" +
      Array.from(
        { length: 26 },
        (_, i) => `<url><loc>https://harbourline-engineering.example/p${i}</loc></url>`,
      ).join("") +
      "</urlset>",
  },
  "https://coastal-pumps.example/": {
    responseTimeMs: 1500,
    html: page({
      title: "Coastal Pump & Valve",
      h1: ["Pumps and valves"],
      sections: [
        { h2: "Products", body: lorem("Supply and repair of industrial pumps and valves.", 10) },
      ],
      links: ["/contact|Contact"],
    }),
  },
  "https://portside-fabrication.example/": {
    responseTimeMs: 1200,
    html: page({
      title: "Portside Fabrication | Steel Fabrication Durban",
      description: "Structural and marine steel fabrication in Durban.",
      h1: ["Steel fabrication for marine and industrial projects"],
      sections: [
        {
          h2: "Capabilities",
          body: lorem(
            "Coded welding, structural steel, marine repairs and on-site installation.",
            20,
          ),
        },
        {
          h2: "What certifications do your welders hold?",
          body: lorem("All welders are coded to ASME IX.", 4),
        },
        {
          h2: "How do you price fabrication work?",
          body: lorem("We quote per project after a site visit.", 4),
        },
        {
          h2: "Can you work on vessels in port?",
          body: lorem("Yes, we hold port access permits.", 4),
        },
        { h2: "Testimonials", body: "Trusted by port operators and contractors." },
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Portside Fabrication",
      },
      links: [
        "/blog|Blog",
        "/about|About",
        "/contact|Get a quote",
        "https://www.linkedin.com/company/portside-demo|LinkedIn",
      ],
    }),
    sitemap: "<urlset><url><loc>https://portside-fabrication.example/</loc></url></urlset>",
  },
};

/** Offline fetcher that serves the demo fixtures. */
export const fixtureFetcher: Fetcher = async (input) => {
  const url = new URL(String(input));
  const site = DEMO_FIXTURES[`${url.origin}/`];
  const respond = (status: number, body: string): FetchedPage => ({
    url: url.href,
    finalUrl: url.href,
    status,
    contentType: "text/html",
    body,
    bytes: Buffer.byteLength(body),
    responseTimeMs: site?.responseTimeMs ?? 500,
    redirects: 0,
  });
  if (!site) throw new Error(`No demo fixture for ${url.origin}`);
  if (url.pathname === "/" || url.pathname === "") return respond(200, site.html);
  if (url.pathname === "/robots.txt")
    return site.robots ? respond(200, site.robots) : respond(404, "");
  if (url.pathname === "/sitemap.xml")
    return site.sitemap ? respond(200, site.sitemap) : respond(404, "");
  return respond(404, "");
};
