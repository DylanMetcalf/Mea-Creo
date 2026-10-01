import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  clientBrainFacts,
  clientGoals,
  clients,
  insights,
  organisations,
  packageItems,
  packages,
  services,
  timelineEntries,
} from "@/db/schema";
import { SERVICE_CATALOGUE } from "@/modules/services/catalogue";
import { setSetting } from "@/modules/settings/service";
import { settingsDefaults } from "@/modules/settings/schema";
import { STARTER_INSIGHTS } from "./content/insights";

export const PLATFORM_SLUG = "mea-creo";
export const INTERNAL_CLIENT_SLUG = "mea-creo-growth";

/**
 * Real business data, safe for every environment (including production):
 * the Mea Creo organisation, the service catalogue (no prices), packages, the
 * internal "Mea Creo Growth" client and starter articles held for review.
 * Idempotent: does nothing if the platform organisation already exists.
 */
export async function seedBase(
  db: DbOrTx,
): Promise<{ platformId: string; internalOrgId: string; created: boolean }> {
  const [existing] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, PLATFORM_SLUG))
    .limit(1);
  if (existing) {
    const [internal] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.slug, INTERNAL_CLIENT_SLUG))
      .limit(1);
    return { platformId: existing.id, internalOrgId: internal?.id ?? "", created: false };
  }

  const [platform] = await db
    .insert(organisations)
    .values({ kind: "platform", name: "Mea Creo", slug: PLATFORM_SLUG })
    .returning();
  for (const key of Object.keys(settingsDefaults) as (keyof typeof settingsDefaults)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await setSetting(db, platform.id, key, settingsDefaults[key] as any);
  }

  const serviceIds = new Map<string, string>();
  for (const [index, s] of SERVICE_CATALOGUE.entries()) {
    const [row] = await db
      .insert(services)
      .values({
        slug: s.slug,
        name: s.name,
        category: s.category,
        billingType: s.billingType,
        summary: s.summary,
        description: s.description,
        includedActivities: s.includedActivities,
        deliverables: s.deliverables,
        kpis: s.kpis,
        requiredInputs: s.requiredInputs,
        requiredIntegrations: s.requiredIntegrations,
        agents: s.agents,
        runKinds: s.runKinds,
        automationLevel: s.automationLevel,
        humanInvolvement: s.humanInvolvement,
        defaultApprovalLevel: s.defaultApprovalLevel,
        selfService: s.selfService ?? false,
        requiresStrategy: s.requiresStrategy ?? true,
        sortOrder: index,
        // Only approved prices (the packages); everything else is priced by the owner.
        prices: s.prices ?? {},
      })
      .returning({ id: services.id });
    serviceIds.set(s.slug, row.id);
  }

  const packageDefs: {
    slug: string;
    name: string;
    description: string;
    services: string[];
    contractMonths: number;
  }[] = [
    {
      slug: "foundation",
      name: "Foundation (once-off)",
      description:
        "Digital visibility audit, assessments across website, search, Google, competitors, conversion and lead generation, and a strategic roadmap.",
      services: ["package-foundation"],
      contractMonths: 1,
    },
    {
      slug: "visibility",
      name: "Visibility",
      description:
        "SEO, GEO, AEO, website optimisation, Google visibility, search content, monitoring and monthly reporting.",
      services: ["package-visibility"],
      contractMonths: 6,
    },
    {
      slug: "growth",
      name: "Growth",
      description:
        "Everything in Visibility, plus content, lead generation, conversion optimisation and AI-assisted workflows.",
      services: ["package-growth"],
      contractMonths: 6,
    },
    {
      slug: "scale",
      name: "Scale",
      description:
        "Everything in Growth, plus advanced search, lead-generation systems, CRM workflows, AI automation and a reporting dashboard.",
      services: ["package-scale"],
      contractMonths: 6,
    },
  ];
  for (const [index, p] of packageDefs.entries()) {
    const [pkg] = await db
      .insert(packages)
      .values({
        slug: p.slug,
        name: p.name,
        description: p.description,
        contractMonths: p.contractMonths,
        sortOrder: index,
      })
      .returning({ id: packages.id });
    await db
      .insert(packageItems)
      .values(p.services.map((slug) => ({ packageId: pkg.id, serviceId: serviceIds.get(slug)! })));
  }

  // Mea Creo's own account: the system is used on Mea Creo first.
  const [internalOrg] = await db
    .insert(organisations)
    .values({ kind: "client", name: "Mea Creo Growth", slug: INTERNAL_CLIENT_SLUG })
    .returning();
  await db.insert(clients).values({
    organisationId: internalOrg.id,
    name: "Mea Creo Growth",
    industry: "Digital visibility, growth & automation",
    website: "https://www.meacreo.co.za",
    location: "Dullstroom, Mpumalanga",
    country: "ZA",
    isInternal: true,
    lifecycle: "active",
    billingState: "active",
    health: "watch",
    healthReasons: [
      {
        signal: "Website",
        detail: "The public website still runs on Wix and needs the new platform launched.",
        effect: "negative",
      },
    ],
    description: "Mea Creo's own growth account. Every service Mea Creo sells is run here first.",
    targetMarket:
      "Companies that value professional visibility, growth and digital systems: mining, electrical, engineering, construction, industrial, manufacturing, corporate, professional and business services, sales organisations, product, technical and specialist B2B businesses.",
  });
  await db.insert(clientBrainFacts).values(
    [
      ["company", "Legal name", "Mea Creo (Pty) Ltd, registration 2022/626541/07"],
      ["company", "Founder", "Dylan Metcalf, founder and director"],
      ["company", "Location", "Dullstroom, Mpumalanga, South Africa"],
      ["company", "VAT", "Not VAT registered"],
      [
        "strategy",
        "Positioning",
        "Mea Creo helps businesses become easier to find, easier to understand and easier to choose: visibility, growth, lead generation, content and automation, sold as business outcomes and systems rather than cheap marketing tasks.",
      ],
      [
        "strategy",
        "Brand promise",
        "Clients are not numbers. Adaptable, quality driven, direct, honest and highly involved; Mea Creo behaves as though the client's business were its own.",
      ],
      [
        "strategy",
        "Approach",
        "Data + psychology + creativity + technology + business strategy. Data informs strategy; it doesn't replace brand, story, audience understanding or emotional response.",
      ],
      [
        "services",
        "Packages",
        "Foundation R7,500 once-off; Visibility R8,500/month; Growth R12,500/month; Scale R18,500/month; Custom by quotation. Not VAT registered: prices are what the client pays.",
      ],
      [
        "audience",
        "Ideal customer",
        "Companies that understand the value of professional visibility, growth and digital systems; strong in mining, electrical, engineering, construction, industrial, manufacturing, corporate, professional services, business services, sales, product, technical and specialist B2B companies. Size is flexible.",
      ],
      [
        "audience",
        "Poor fit",
        "Expects agency work at very low prices, doesn't value professional marketing, wants endless free work, won't invest, treats marketing as an afterthought, or expects immediate results without strategy.",
      ],
      [
        "restricted_claims",
        "No guarantees",
        "Never promise guaranteed rankings, leads, AI citations, sales or revenue.",
      ],
      [
        "restricted_claims",
        "No tax advice",
        "Never give tax advice to clients. Never represent Mea Creo as VAT registered.",
      ],
      [
        "tone",
        "Voice",
        "Human, direct, specific and confident. Never 'Dear Sir/Madam' or 'a leading digital marketing agency'. Avoid buzzwords such as 'cutting-edge', 'revolutionary' and 'unlock your potential'.",
      ],
    ].map(([category, label, value]) => ({
      organisationId: internalOrg.id,
      category: category as (typeof clientBrainFacts.$inferInsert)["category"],
      label,
      value,
      sourceType: "human" as const,
      verification: "verified" as const,
    })),
  );
  await db.insert(clientGoals).values([
    {
      organisationId: internalOrg.id,
      title: "Launch the new Mea Creo website and leave Wix",
      kpi: "New site live with redirects",
      status: "active",
    },
    {
      organisationId: internalOrg.id,
      title: "Generate qualified leads through the free Visibility Report",
      kpi: "Qualified reports per month",
      status: "active",
    },
    {
      organisationId: internalOrg.id,
      title: "Publish useful insights consistently",
      kpi: "Articles published per month",
      status: "active",
    },
  ]);
  await db.insert(timelineEntries).values({
    organisationId: internalOrg.id,
    kind: "milestone",
    title: "Mea Creo platform set up",
    description: "The workspace, client portal and Visibility Report engine were installed.",
    visibility: "client",
  });

  for (const article of STARTER_INSIGHTS) {
    await db.insert(insights).values({ ...article, authorName: "Dylan Metcalf", status: "review" });
  }

  return { platformId: platform.id, internalOrgId: internalOrg.id, created: true };
}
