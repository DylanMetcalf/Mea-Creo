import { siteConfig } from "@/config/site";
import { PILLARS } from "@/content/pillars";
import { SERVICE_INTENTS } from "@/content/service-intents";

/**
 * /llms.txt: a plain-text summary some AI tools read to understand a site. Built from the
 * same content as the pages, so it can't drift from what the site says.
 */
export function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const c = siteConfig.contact;
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    `${siteConfig.legalName} (registration ${siteConfig.registrationNumber}), founded and directed by ${siteConfig.director}, based in ${c.locality}, ${c.region}, ${c.country}. Works with clients in South Africa and internationally.`,
    "",
    "## Services",
    ...SERVICE_INTENTS.map((i) => `- ${i.label}: ${i.line}`),
    "",
    "## Service pages",
    ...PILLARS.map((p) => `- [${p.seoTitle}](${site}/services/${p.slug}): ${p.metaDescription}`),
    "",
    "## Key pages",
    `- [Free Visibility Report](${site}/visibility-report): an automated check of how a business shows up in search and AI answers.`,
    `- [Book a call](${site}/book)`,
    `- [Pricing](${site}/pricing)`,
    `- [About](${site}/about)`,
    `- [Contact](${site}/contact)`,
    "",
    "## Contact",
    `- Email: ${c.email}`,
    `- Phone: ${c.phone}`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
