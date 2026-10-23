/**
 * What a visitor is looking for, in their words. Drives the home page "What do you need?"
 * tiles and the contact form's interest field, so every enquiry records the service asked
 * about. Each links to the pillar page where that service is described.
 */
export const SERVICE_INTENTS = [
  {
    slug: "seo-aeo-geo",
    label: "SEO, AEO & GEO",
    line: "Be found on Google and named in AI answers.",
    href: "/services/visibility",
  },
  {
    slug: "linkedin",
    label: "LinkedIn networking",
    line: "Grow and work a network of the right decision-makers.",
    href: "/services/growth",
  },
  {
    slug: "social-media",
    label: "Social media management",
    line: "Consistent, on-brand posting that people engage with.",
    href: "/services/content",
  },
  {
    slug: "photo-video",
    label: "Photography & videography",
    line: "Shoots that show your people, work and place properly.",
    href: "/services/content",
  },
  {
    slug: "websites",
    label: "Websites",
    line: "Fast, clear websites built to turn visitors into enquiries.",
    href: "/services/technology",
  },
  {
    slug: "apps",
    label: "Apps, portals & dashboards",
    line: "Custom tools for your team and your clients.",
    href: "/services/technology",
  },
  {
    slug: "automation",
    label: "AI & business optimisation",
    line: "Automate the admin and tighten how the business runs.",
    href: "/services/technology",
  },
  {
    slug: "leads",
    label: "Lead generation",
    line: "A steady, measurable flow of qualified enquiries.",
    href: "/services/growth",
  },
] as const;

export type ServiceIntentSlug = (typeof SERVICE_INTENTS)[number]["slug"];

export function serviceIntent(slug: string | undefined) {
  return SERVICE_INTENTS.find((i) => i.slug === slug);
}
