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
        prices: {},
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
      slug: "visibility",
      name: "Visibility",
      description: "Get found on Google and understood by AI search.",
      services: ["seo", "geo", "aeo"],
      contractMonths: 6,
    },
    {
      slug: "growth",
      name: "Growth",
      description: "Turn visibility into conversations and enquiries.",
      services: ["lead-generation", "linkedin-networking", "conversion-optimisation"],
      contractMonths: 6,
    },
    {
      slug: "growth-visibility",
      name: "Growth + Visibility",
      description: "Be found, then turn attention into pipeline.",
      services: ["seo", "geo", "aeo", "lead-generation", "conversion-optimisation"],
      contractMonths: 6,
    },
    {
      slug: "full-growth-system",
      name: "Full Growth System",
      description: "Visibility, growth, content and reporting automation as one managed system.",
      services: [
        "seo",
        "geo",
        "aeo",
        "lead-generation",
        "linkedin-networking",
        "content-creation",
        "reporting-automation",
      ],
      contractMonths: 12,
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
    location: "Pretoria, Gauteng",
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
      "B2B and professional service businesses with 10–200 employees in South Africa and internationally.",
  });
  await db.insert(clientBrainFacts).values(
    [
      ["company", "Legal name", "Mea Creo (Pty) Ltd"],
      ["company", "Founder", "Dylan Metcalf, founder and operator"],
      ["company", "Location", "Pretoria, Gauteng, South Africa"],
      [
        "services",
        "Service pillars",
        "Visibility (SEO, GEO, AEO, AI search), Growth (lead generation, Google Ads, LinkedIn), Automation (AI workflows, reporting), Creative (photography, video, design, content)",
      ],
      [
        "audience",
        "Ideal customer",
        "B2B and professional service businesses, 10–200 employees, with strong offerings but weak digital visibility",
      ],
      [
        "restricted_claims",
        "No guarantees",
        "Never promise guaranteed rankings, leads, AI citations, sales or revenue.",
      ],
      [
        "tone",
        "Voice",
        "Plain, confident, specific. Avoid buzzwords such as 'cutting-edge', 'revolutionary' and 'unlock your potential'.",
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
