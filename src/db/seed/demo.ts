import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  approvals,
  clientAssignments,
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  competitors,
  contacts,
  contentItems,
  documents,
  insights,
  invoiceLines,
  invoices,
  leadActivities,
  leads,
  meetings,
  memberships,
  messages,
  organisations,
  payments,
  proposalItems,
  proposals,
  reports,
  services,
  subscriptions,
  tasks,
  timelineEntries,
  users,
  type ReportContent,
  type ServicePrices,
} from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { randomToken, uuidv7 } from "@/lib/ids";
import { generatePdf } from "@/lib/pdf";
import { hashPassword } from "@/modules/auth/password";
import { processAudit } from "@/modules/audits/service";
import { getPlatformOrganisation, getSetting, setSetting } from "@/modules/settings/service";
import { audits } from "@/db/schema";
import { fixtureFetcher } from "./fixtures";

/** Demo sign-in details. Shown on the login page only while demo data exists. */
export const DEMO_ACCOUNTS = {
  founder: {
    email: "dylan@demo.meacreo.test",
    password: "MeaCreoDemo2026!",
    name: "Dylan Metcalf",
  },
  clientA: {
    email: "thandi@demo.meacreo.test",
    password: "ClientDemo2026!",
    name: "Thandi Nkosi (Demo)",
  },
  clientB: {
    email: "pieter@demo.meacreo.test",
    password: "ClientDemo2026!",
    name: "Pieter van Wyk (Demo)",
  },
} as const;

/**
 * DEMO prices, clearly flagged (billing.pricesAreDemo = true). They exist so the demo
 * proposals and invoices make sense. Replace with real pricing in Workspace → Services.
 */
const DEMO_PRICES_ZAR: Record<string, ServicePrices["ZAR"]> = {
  seo: { setupMinor: 500000, monthlyMinor: 850000 },
  geo: { monthlyMinor: 450000 },
  aeo: { monthlyMinor: 350000 },
  "technical-seo": { oneOffMinor: 1200000 },
  "local-google-visibility": { monthlyMinor: 250000 },
  "visibility-monitoring": { monthlyMinor: 150000 },
  "lead-generation": { setupMinor: 400000, monthlyMinor: 950000 },
  "linkedin-networking": { monthlyMinor: 600000 },
  "google-ads": { setupMinor: 350000, monthlyMinor: 550000 },
  "conversion-optimisation": { monthlyMinor: 450000 },
  "ai-workflow-automation": { oneOffMinor: 2500000 },
  "reporting-automation": { setupMinor: 300000, monthlyMinor: 250000 },
  "automation-consulting": { oneOffMinor: 750000 },
  "content-creation": { monthlyMinor: 650000 },
  photography: { oneOffMinor: 600000 },
  videography: { oneOffMinor: 1200000 },
  "graphic-design": { oneOffMinor: 350000 },
  "social-media": { monthlyMinor: 650000 },
  "website-development": { oneOffMinor: 4500000 },
  "landing-pages": { oneOffMinor: 950000 },
};

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number, hour = 9, minute = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function storeDemoPdf(organisationId: string, name: string, title: string, lines: string[]) {
  const storage = resolveIntegration("storage");
  if (!storage.available) return null;
  const body = generatePdf({
    title,
    footer: "DEMO DOCUMENT: fictional content",
    blocks: [
      { type: "title", text: title },
      { type: "subtitle", text: "Demo document for the Mea Creo walkthrough (fictional)" },
      { type: "rule" },
      ...lines.map((text) => ({ type: "p" as const, text })),
    ],
  });
  const key = `orgs/${organisationId}/documents/${uuidv7()}/${name}`;
  await storage.adapter.putObject(key, new Uint8Array(body), "application/pdf");
  return { key, size: body.byteLength };
}

export async function seedDemo(db: Db): Promise<void> {
  const [already] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_ACCOUNTS.founder.email))
    .limit(1);
  if (already) return;

  const platform = await getPlatformOrganisation(db);
  const billing = await getSetting(db, platform.id, "billing");
  await setSetting(db, platform.id, "billing", { ...billing, pricesAreDemo: true });

  // Demo prices on the catalogue.
  const allServices = await db.select().from(services);
  const svc = new Map(allServices.map((s) => [s.slug, s]));
  for (const s of allServices) {
    const price = DEMO_PRICES_ZAR[s.slug];
    if (price)
      await db
        .update(services)
        .set({ prices: { ZAR: price } })
        .where(eq(services.id, s.id));
  }
  const price = (slug: string) => DEMO_PRICES_ZAR[slug] ?? {};

  // ---------------------------------------------------------------- People
  const [founder] = await db
    .insert(users)
    .values({
      email: DEMO_ACCOUNTS.founder.email,
      name: DEMO_ACCOUNTS.founder.name,
      passwordHash: await hashPassword(DEMO_ACCOUNTS.founder.password),
      emailVerifiedAt: new Date(),
      title: "Founder",
      isDemo: true,
    })
    .returning();
  await db
    .insert(memberships)
    .values({ userId: founder.id, organisationId: platform.id, role: "founder" });

  // ---------------------------------------------------------------- Client A: healthy
  const [orgA] = await db
    .insert(organisations)
    .values({
      kind: "client",
      name: "Harbourline Engineering (Demo)",
      slug: "harbourline-demo",
      isDemo: true,
    })
    .returning();
  const [clientAUser] = await db
    .insert(users)
    .values({
      email: DEMO_ACCOUNTS.clientA.email,
      name: DEMO_ACCOUNTS.clientA.name,
      passwordHash: await hashPassword(DEMO_ACCOUNTS.clientA.password),
      emailVerifiedAt: new Date(),
      title: "Marketing & Operations Manager",
      isDemo: true,
    })
    .returning();
  await db
    .insert(memberships)
    .values({ userId: clientAUser.id, organisationId: orgA.id, role: "client_admin" });
  const aServices = ["seo", "geo", "aeo", "content-creation", "lead-generation"];
  const aMonthly = aServices.reduce((sum, s) => sum + (price(s)?.monthlyMinor ?? 0), 0);
  await db.insert(clients).values({
    organisationId: orgA.id,
    name: "Harbourline Engineering (Demo)",
    industry: "Marine & industrial engineering",
    website: "https://harbourline-engineering.example",
    location: "Durban, KwaZulu-Natal",
    country: "ZA",
    employeeRange: "11-50",
    phone: "+27 31 000 0000",
    email: "info@harbourline-engineering.example",
    linkedinUrl: "https://www.linkedin.com/company/harbourline-demo",
    description:
      "Fictional demo client: pump and valve overhauls, fabrication and maintenance contracts for port and industrial customers.",
    targetMarket:
      "Port operators, shipping agents and industrial plants in KwaZulu-Natal and the Eastern Cape.",
    lifecycle: "active",
    billingState: "active",
    accountManagerId: founder.id,
    startDate: isoDate(at(-122)),
    renewalDate: isoDate(at(60)),
    monthlyValueMinor: aMonthly,
    brandVoice: "Practical, technical, reassuring. Short sentences. No hype.",
  });
  await db.insert(clientAssignments).values([
    { organisationId: orgA.id, userId: founder.id, responsibility: "account_manager" },
    { organisationId: orgA.id, userId: founder.id, responsibility: "seo" },
  ]);
  await db.insert(contacts).values([
    {
      organisationId: orgA.id,
      name: DEMO_ACCOUNTS.clientA.name,
      email: DEMO_ACCOUNTS.clientA.email,
      role: "Marketing & Operations Manager",
      isPrimary: true,
      isDecisionMaker: false,
    },
    {
      organisationId: orgA.id,
      name: "Rajesh Pillay (Demo)",
      email: "rajesh@harbourline-engineering.example",
      role: "Managing Director",
      isDecisionMaker: true,
    },
  ]);
  const clientServiceIds: Record<string, string> = {};
  for (const slug of aServices) {
    const [row] = await db
      .insert(clientServices)
      .values({
        organisationId: orgA.id,
        serviceId: svc.get(slug)!.id,
        status: "active",
        monthlyMinor: price(slug)?.monthlyMinor ?? 0,
        setupMinor: price(slug)?.setupMinor ?? 0,
        startedAt: at(slug === "lead-generation" ? -40 : -122),
        currentFocus:
          slug === "seo"
            ? "Optimising the pump overhaul and breakdown-response service pages."
            : slug === "geo"
              ? "Completing structured data and aligning company facts across directories."
              : slug === "aeo"
                ? "Answering the top 12 questions from the sales team."
                : slug === "content-creation"
                  ? "Two articles per month on maintenance planning."
                  : "Building a list of port operators and shipping agents for approved outreach.",
      })
      .returning({ id: clientServices.id });
    clientServiceIds[slug] = row.id;
  }
  await db.insert(clientBrainFacts).values(
    [
      [
        "company",
        "What they do",
        "Pump and valve overhauls, steel fabrication, planned maintenance and 24-hour breakdown response.",
        "verified",
        "human",
      ],
      [
        "locations",
        "Service area",
        "Durban metro (24-hour standby), KwaZulu-Natal and the Eastern Cape.",
        "verified",
        "client",
      ],
      [
        "audience",
        "Primary buyers",
        "Maintenance managers at port operators, shipping agents and industrial plants.",
        "verified",
        "human",
      ],
      [
        "differentiators",
        "Response time",
        "Standby breakdown team within the Durban metro.",
        "verified",
        "client",
      ],
      [
        "keywords",
        "Priority topics",
        "pump overhaul Durban; marine engineering Durban; industrial maintenance contracts KZN",
        "verified",
        "human",
      ],
      ["approved_claims", "Accreditation", "ISO 9001 certified (demo fact).", "verified", "client"],
      [
        "restricted_claims",
        "Response guarantees",
        "Do not state guaranteed response times in writing.",
        "verified",
        "client",
      ],
      ["tone", "Voice", "Practical, technical, reassuring. No hype.", "verified", "human"],
      [
        "strategy",
        "Suggested: fleet maintenance page",
        "A dedicated page for vessel fleet maintenance contracts could capture demand (agent suggestion).",
        "unverified",
        "agent",
      ],
    ].map(([category, label, value, verification, sourceType]) => ({
      organisationId: orgA.id,
      category: category as (typeof clientBrainFacts.$inferInsert)["category"],
      label: label!,
      value: value!,
      verification: verification as "verified" | "unverified",
      sourceType: sourceType as "human" | "client" | "agent",
    })),
  );
  await db.insert(clientGoals).values([
    {
      organisationId: orgA.id,
      title: "More qualified enquiries from organic search",
      kpi: "Organic enquiries per month",
      baseline: "4 (demo)",
      target: "12 (demo)",
      current: "7 (demo)",
      dueDate: isoDate(at(120)),
    },
    {
      organisationId: orgA.id,
      title: "Be the clear answer for 'pump overhaul Durban'",
      kpi: "Average position (Search Console)",
      baseline: "18 (demo)",
      target: "Top 5 (demo)",
      current: "9 (demo)",
    },
    {
      organisationId: orgA.id,
      title: "Open doors with 20 port and shipping decision makers",
      kpi: "Meetings from outreach",
      target: "6 per quarter (demo)",
      current: "2 (demo)",
    },
  ]);
  await db.insert(competitors).values([
    {
      organisationId: orgA.id,
      name: "Coastal Pump & Valve (Demo)",
      website: "https://coastal-pumps.example",
      notes: "Fictional competitor.",
    },
    {
      organisationId: orgA.id,
      name: "Portside Fabrication (Demo)",
      website: "https://portside-fabrication.example",
      notes: "Fictional competitor with a stronger content section.",
    },
  ]);
  await db.insert(timelineEntries).values(
    [
      [
        -122,
        "onboarding",
        "Onboarding completed",
        "Brand, goals, access and approval preferences confirmed.",
      ],
      [
        -118,
        "work",
        "Technical visibility audit completed",
        "22 issues found; 14 fixed in the first month.",
      ],
      [
        -104,
        "work",
        "Homepage and service pages optimised",
        "Titles, headings and service descriptions rewritten around buyer searches.",
      ],
      [
        -90,
        "work",
        "Structured data added",
        "Organization and Service data now describe the business to search and AI systems.",
      ],
      [
        -75,
        "result",
        "First page for 'pump overhaul Durban' (demo)",
        "Average position moved from 18 to 9 in Search Console (demo figure).",
      ],
      [-60, "report", "Monthly report published", "July report."],
      [
        -40,
        "milestone",
        "Lead generation launched",
        "First prospect list of 40 port and shipping companies approved.",
      ],
      [-30, "report", "Monthly report published", "August report."],
      [-12, "work", "FAQ section published", "12 buyer questions answered on the services page."],
      [
        -4,
        "opportunity",
        "New opportunity: Google Ads for breakdown searches",
        "Urgent searches suit paid search; see recommendations.",
      ],
    ].map(([days, kind, title, description]) => ({
      organisationId: orgA.id,
      occurredAt: at(days as number, 11),
      kind: kind as (typeof timelineEntries.$inferInsert)["kind"],
      title: title as string,
      description: description as string,
      visibility: "client" as const,
    })),
  );

  // ---------------------------------------------------------------- Client B: payment overdue, services paused
  const [orgB] = await db
    .insert(organisations)
    .values({
      kind: "client",
      name: "Veldt Precision Manufacturing (Demo)",
      slug: "veldt-demo",
      isDemo: true,
    })
    .returning();
  const [clientBUser] = await db
    .insert(users)
    .values({
      email: DEMO_ACCOUNTS.clientB.email,
      name: DEMO_ACCOUNTS.clientB.name,
      passwordHash: await hashPassword(DEMO_ACCOUNTS.clientB.password),
      emailVerifiedAt: new Date(),
      title: "Sales Director",
      isDemo: true,
    })
    .returning();
  await db
    .insert(memberships)
    .values({ userId: clientBUser.id, organisationId: orgB.id, role: "client_admin" });
  const bServices = ["seo", "google-ads", "conversion-optimisation"];
  await db.insert(clients).values({
    organisationId: orgB.id,
    name: "Veldt Precision Manufacturing (Demo)",
    industry: "Precision manufacturing (CNC)",
    website: "https://veldt-precision.example",
    location: "Johannesburg, Gauteng",
    country: "ZA",
    employeeRange: "51-200",
    description:
      "Fictional demo client: CNC machining and precision components for automotive and mining-equipment OEMs.",
    targetMarket: "Procurement and engineering managers at OEMs.",
    lifecycle: "active",
    billingState: "overdue",
    accountManagerId: founder.id,
    startDate: isoDate(at(-75)),
    renewalDate: isoDate(at(105)),
    monthlyValueMinor: bServices.reduce((sum, s) => sum + (price(s)?.monthlyMinor ?? 0), 0),
  });
  await db
    .insert(clientAssignments)
    .values({ organisationId: orgB.id, userId: founder.id, responsibility: "account_manager" });
  await db.insert(contacts).values({
    organisationId: orgB.id,
    name: DEMO_ACCOUNTS.clientB.name,
    email: DEMO_ACCOUNTS.clientB.email,
    role: "Sales Director",
    isPrimary: true,
    isDecisionMaker: true,
  });
  for (const slug of bServices) {
    const automated = slug !== "google-ads";
    await db.insert(clientServices).values({
      organisationId: orgB.id,
      serviceId: svc.get(slug)!.id,
      status: automated ? "paused" : "active",
      monthlyMinor: price(slug)?.monthlyMinor ?? 0,
      setupMinor: price(slug)?.setupMinor ?? 0,
      startedAt: at(-75),
      pausedAt: automated ? at(-4) : null,
      pauseReason: automated ? "billing" : null,
      currentFocus:
        slug === "google-ads" ? "Campaigns running; optimisation paused pending payment." : null,
    });
  }
  await db.insert(timelineEntries).values([
    {
      organisationId: orgB.id,
      occurredAt: at(-75, 10),
      kind: "onboarding",
      title: "Onboarding completed",
      visibility: "client",
    },
    {
      organisationId: orgB.id,
      occurredAt: at(-60, 10),
      kind: "work",
      title: "Google Ads campaigns launched",
      description: "Search campaigns for CNC machining and precision components.",
      visibility: "client",
    },
    {
      organisationId: orgB.id,
      occurredAt: at(-4, 10),
      kind: "billing",
      title: "Automated work paused",
      description: "Invoice overdue. Reports and documents remain available.",
      visibility: "client",
    },
  ]);

  // ---------------------------------------------------------------- Billing
  const invoicePrefix = "MC";
  let invoiceSeq = 1;
  const nextNumber = () => `${invoicePrefix}-2026-${String(invoiceSeq++).padStart(4, "0")}`;
  async function createInvoice(
    orgId: string,
    opts: {
      kind: "setup" | "monthly";
      lines: [string, number][];
      issued: Date;
      due: Date;
      status: "open" | "paid" | "overdue";
      paidAt?: Date;
    },
  ) {
    const total = opts.lines.reduce((s, [, amount]) => s + amount, 0);
    const [inv] = await db
      .insert(invoices)
      .values({
        organisationId: orgId,
        number: nextNumber(),
        kind: opts.kind,
        status: opts.status,
        subtotalMinor: total,
        totalMinor: total,
        amountPaidMinor: opts.status === "paid" ? total : 0,
        issuedAt: opts.issued,
        dueAt: opts.due,
        paidAt: opts.paidAt,
        description:
          opts.kind === "setup"
            ? "Setup fees"
            : `Monthly services: ${opts.issued.toLocaleString("en-ZA", { month: "long", year: "numeric" })}`,
        periodStart: isoDate(opts.issued),
      })
      .returning();
    await db.insert(invoiceLines).values(
      opts.lines.map(([description, amount]) => ({
        invoiceId: inv.id,
        description,
        quantity: 1,
        unitMinor: amount,
        amountMinor: amount,
      })),
    );
    if (opts.status === "paid") {
      await db.insert(payments).values({
        organisationId: orgId,
        invoiceId: inv.id,
        provider: "mock",
        providerPaymentId: `demo-${inv.number}`,
        status: "succeeded",
        amountMinor: total,
        receivedAt: opts.paidAt ?? opts.due,
      });
    }
    return inv;
  }
  const aLines = aServices.map(
    (s) => [svc.get(s)!.name, price(s)?.monthlyMinor ?? 0] as [string, number],
  );
  await createInvoice(orgA.id, {
    kind: "setup",
    lines: [["SEO setup", price("seo")?.setupMinor ?? 0]],
    issued: at(-124),
    due: at(-117),
    status: "paid",
    paidAt: at(-122),
  });
  for (const monthsAgo of [3, 2, 1]) {
    await createInvoice(orgA.id, {
      kind: "monthly",
      lines: aLines,
      issued: at(-30 * monthsAgo),
      due: at(-30 * monthsAgo + 7),
      status: "paid",
      paidAt: at(-30 * monthsAgo + 3),
    });
  }
  await createInvoice(orgA.id, {
    kind: "monthly",
    lines: aLines,
    issued: at(-2),
    due: at(5),
    status: "open",
  });
  await db.insert(subscriptions).values({
    organisationId: orgA.id,
    status: "active",
    provider: "mock",
    providerToken: "demo-sub-harbourline",
    amountMinor: aMonthly,
    nextBillingDate: isoDate(at(28)),
  });

  const bLines = bServices.map(
    (s) => [svc.get(s)!.name, price(s)?.monthlyMinor ?? 0] as [string, number],
  );
  await createInvoice(orgB.id, {
    kind: "setup",
    lines: [
      ["SEO setup", price("seo")?.setupMinor ?? 0],
      ["Google Ads setup", price("google-ads")?.setupMinor ?? 0],
    ],
    issued: at(-77),
    due: at(-70),
    status: "paid",
    paidAt: at(-75),
  });
  await createInvoice(orgB.id, {
    kind: "monthly",
    lines: bLines,
    issued: at(-47),
    due: at(-40),
    status: "paid",
    paidAt: at(-41),
  });
  await createInvoice(orgB.id, {
    kind: "monthly",
    lines: bLines,
    issued: at(-25),
    due: at(-18),
    status: "overdue",
  });

  // ---------------------------------------------------------------- Tasks
  const task = (orgId: string, title: string, o: Partial<typeof tasks.$inferInsert> = {}) => ({
    organisationId: orgId,
    title,
    createdById: founder.id,
    assigneeId: founder.id,
    ...o,
  });
  await db.insert(tasks).values([
    task(orgA.id, "Write October article: planned maintenance vs breakdown costs", {
      status: "in_progress",
      priority: "high",
      dueAt: at(2, 17),
      clientServiceId: clientServiceIds["content-creation"],
      visibility: "client",
    }),
    task(orgA.id, "Optimise 'fabrication' service page title and headings", {
      status: "ready",
      dueAt: at(0, 16),
      clientServiceId: clientServiceIds.seo,
      visibility: "client",
    }),
    task(orgA.id, "Add Service structured data to 6 service pages", {
      status: "ready",
      dueAt: at(4, 16),
      clientServiceId: clientServiceIds.geo,
      visibility: "client",
    }),
    task(orgA.id, "Confirm list of 20 port operators for outreach", {
      status: "waiting_client",
      dueAt: at(-2, 12),
      clientServiceId: clientServiceIds["lead-generation"],
      visibility: "client",
      description: "Waiting for Thandi to confirm which existing customers to exclude.",
    }),
    task(orgA.id, "Upload new workshop photos for service pages", {
      status: "waiting_client",
      dueAt: at(6, 12),
      visibility: "client",
      assigneeId: null,
    }),
    task(orgA.id, "Review September monthly report before publishing", {
      status: "waiting_approval",
      priority: "high",
      dueAt: at(0, 12),
      source: "run",
      visibility: "internal",
    }),
    task(orgA.id, "Fix 4 images without alt text on the About page", {
      status: "complete",
      completedAt: at(-6),
      completedById: founder.id,
      clientServiceId: clientServiceIds.seo,
      visibility: "client",
    }),
    task(orgA.id, "Publish FAQ section with 12 buyer questions", {
      status: "complete",
      completedAt: at(-12),
      completedById: founder.id,
      clientServiceId: clientServiceIds.aeo,
      visibility: "client",
    }),
    task(orgB.id, "Follow up on overdue invoice MC-2026-0008", {
      status: "ready",
      priority: "urgent",
      dueAt: at(-1, 10),
      visibility: "internal",
    }),
    task(orgB.id, "Pause conversion test until billing is resolved", {
      status: "complete",
      completedAt: at(-4),
      completedById: founder.id,
      visibility: "internal",
      source: "workflow",
    }),
    task(orgB.id, "Prepare Google Ads search term review", {
      status: "blocked",
      dueAt: at(3),
      description: "Blocked: automated optimisation paused while the account is overdue.",
      visibility: "client",
    }),
    task(platform.id, "Verify company details before launch (VAT, registration, address)", {
      status: "ready",
      priority: "high",
      dueAt: at(1),
    }),
    task(platform.id, "Replace demo prices with real pricing", {
      status: "ready",
      priority: "high",
      dueAt: at(2),
    }),
    task(platform.id, "Approve starter Insights articles for publishing", {
      status: "ready",
      dueAt: at(3),
    }),
    task(platform.id, "Collect permissioned testimonials from two past clients", {
      status: "backlog",
      dueAt: at(10),
    }),
    task(platform.id, "Prepare for Blue Crane discovery call", {
      status: "ready",
      priority: "high",
      dueAt: at(1, 9),
      source: "meeting",
    }),
  ]);

  // ---------------------------------------------------------------- Approvals
  await db.insert(approvals).values([
    {
      organisationId: orgA.id,
      level: "client",
      type: "content",
      title: "Article: Planned maintenance vs breakdown repairs, what it really costs",
      description:
        "October article for the Insights section. Targets 'planned maintenance contract Durban'.",
      preview:
        "Unplanned pump failures rarely happen at a convenient time. For port operators, a single day of downtime can outweigh a year of planned maintenance...\n\n## What planned maintenance includes\n- Scheduled inspections and vibration checks\n- Seal and bearing replacement before failure\n- Documented service history for audits\n\n## When breakdown repair still makes sense\n...",
      requestedAction: "Approve for publishing",
      requestedByAgent: "content",
      dueAt: at(3),
    },
    {
      organisationId: orgA.id,
      level: "client",
      type: "website_change",
      title: "Update page titles and descriptions on 6 service pages",
      description:
        "Rewrite titles and meta descriptions to match what buyers search for. No design changes.",
      preview:
        "Pump overhauls: 'Pump & Valve Overhauls in Durban | Harbourline Engineering'\nFabrication: 'Marine & Industrial Steel Fabrication, Durban | Harbourline'\n(4 more…)",
      requestedAction: "Approve changes",
      requestedByAgent: "seo",
      dueAt: at(2),
    },
    {
      organisationId: orgA.id,
      level: "internal",
      type: "report",
      title: "Publish September monthly report to client",
      description: "Drafted by the Reporting agent from the monthly review run. QC checks passed.",
      requestedAction: "Approve & publish",
      requestedByAgent: "reporting",
    },
    {
      organisationId: orgB.id,
      level: "client",
      type: "budget",
      title: "Increase Google Ads budget by R3,000/month (demo)",
      description:
        "Search impression share is limited by budget on 'CNC machining Johannesburg'. Budget changes always need client approval.",
      requestedAction: "Approve budget change",
      requestedByAgent: "analytics",
    },
  ]);

  // ---------------------------------------------------------------- Reports
  const septReport: ReportContent = {
    headline: "Search visibility kept improving, and the first outreach conversations started.",
    whatWeDid: [
      "Published the FAQ section (12 buyer questions)",
      "Optimised 3 service pages",
      "Added Service structured data to 4 pages",
      "Built and approved a list of 40 target companies",
      "Sent 18 approved outreach emails",
    ],
    whatChanged: [
      "Organic clicks up 22% vs August (demo)",
      "'pump overhaul Durban' moved from position 11 to 9 (demo)",
      "2 meetings booked from outreach (demo)",
    ],
    whatWeLearned: [
      "Question-style pages attract clicks from maintenance managers researching costs",
      "Shipping agents respond better to breakdown-response messaging than to maintenance contracts",
    ],
    opportunities: [
      "Google Ads for urgent 'breakdown' searches outside business hours",
      "A dedicated fleet maintenance page",
    ],
    whatHappensNext: [
      "Publish the October article (awaiting your approval)",
      "Update 6 service page titles (awaiting your approval)",
      "Second outreach wave to 20 port operators",
    ],
    needsFromYou: [
      "Approve the October article",
      "Confirm the outreach exclusion list",
      "Upload new workshop photos",
    ],
    activityMetrics: [
      { label: "Pages optimised", value: "3" },
      { label: "Articles published", value: "1" },
      { label: "Outreach emails (approved)", value: "18" },
    ],
    outcomeMetrics: [
      {
        label: "Organic clicks",
        value: "412",
        change: "+22%",
        trend: "up",
        source: "Demo data (fictional)",
      },
      {
        label: "Organic impressions",
        value: "18,940",
        change: "+15%",
        trend: "up",
        source: "Demo data (fictional)",
      },
      {
        label: "Enquiries from website",
        value: "7",
        change: "+2",
        trend: "up",
        source: "Demo data (fictional)",
      },
      {
        label: "Meetings from outreach",
        value: "2",
        change: "new",
        trend: "up",
        source: "Demo data (fictional)",
      },
    ],
    dataNotes: ["All figures in this demo report are fictional."],
  };
  const augReport: ReportContent = {
    ...septReport,
    headline: "Technical fixes are complete and search visibility is climbing.",
    whatWeDid: [
      "Completed remaining technical fixes",
      "Rewrote the homepage around buyer searches",
      "Added Organization structured data",
    ],
    whatChanged: [
      "Organic clicks up 31% vs July (demo)",
      "Indexed pages increased from 14 to 26 (demo)",
    ],
    whatHappensNext: ["Launch lead generation", "Publish the FAQ section"],
    needsFromYou: [],
    outcomeMetrics: [
      {
        label: "Organic clicks",
        value: "338",
        change: "+31%",
        trend: "up",
        source: "Demo data (fictional)",
      },
      {
        label: "Enquiries from website",
        value: "5",
        change: "+1",
        trend: "up",
        source: "Demo data (fictional)",
      },
    ],
  };
  await db.insert(reports).values([
    {
      organisationId: orgA.id,
      title: "August 2026 report",
      periodStart: at(-60),
      periodEnd: at(-31),
      status: "published",
      content: augReport,
      publishedAt: at(-29),
      createdById: founder.id,
    },
    {
      organisationId: orgA.id,
      title: "September 2026 report",
      periodStart: at(-30),
      periodEnd: at(-1),
      status: "in_review",
      content: septReport,
      createdById: founder.id,
    },
  ]);

  // ---------------------------------------------------------------- Content pipeline
  await db.insert(contentItems).values([
    {
      organisationId: orgA.id,
      title: "Planned maintenance vs breakdown repairs",
      channel: "blog",
      stage: "client_approval",
      targetKeyword: "planned maintenance contract Durban",
      rationale: "High commercial intent; answers a common sales question.",
    },
    {
      organisationId: orgA.id,
      title: "How long does a pump overhaul take?",
      channel: "blog",
      stage: "brief",
      targetKeyword: "pump overhaul time",
      rationale: "Question appears in sales calls and search suggestions.",
    },
    {
      organisationId: orgA.id,
      title: "Fleet maintenance services page",
      channel: "website",
      stage: "idea",
      rationale: "Agent suggestion (unverified): demand for vessel fleet contracts.",
    },
    {
      organisationId: orgA.id,
      title: "LinkedIn: behind the scenes of a 24-hour breakdown call-out",
      channel: "linkedin",
      stage: "draft",
    },
    {
      organisationId: orgA.id,
      title: "FAQ: 12 buyer questions",
      channel: "website",
      stage: "measuring",
      publishedAt: at(-12),
      publishedUrl: "https://harbourline-engineering.example/services#faq",
      performance: { clicks: "54 (demo)" },
    },
  ]);

  // ---------------------------------------------------------------- Documents
  const docDefs: [
    string,
    string,
    "brand_guidelines" | "contract" | "strategy" | "report" | "meeting_notes",
    string[],
    "client" | "internal",
  ][] = [
    [
      orgA.id,
      "Harbourline brand guidelines.pdf",
      "brand_guidelines",
      [
        "Logo usage, colours (navy and signal orange), typography and photography style.",
        "Fictional demo document.",
      ],
      "client",
    ],
    [
      orgA.id,
      "Service agreement (signed).pdf",
      "contract",
      [
        "Services: SEO, GEO, AEO, content creation, lead generation.",
        "Term: 6 months. Fictional demo document.",
      ],
      "client",
    ],
    [
      orgA.id,
      "Visibility strategy Q4.pdf",
      "strategy",
      [
        "Priorities: breakdown-response visibility, question coverage, outreach to port operators.",
        "Fictional demo document.",
      ],
      "client",
    ],
    [
      orgA.id,
      "Internal account notes.pdf",
      "meeting_notes",
      [
        "Internal only: margin notes and team capacity planning. Never visible to the client.",
        "Fictional demo document.",
      ],
      "internal",
    ],
    [
      orgB.id,
      "Veldt service agreement.pdf",
      "contract",
      ["Services: SEO, Google Ads, conversion optimisation.", "Fictional demo document."],
      "client",
    ],
  ];
  for (const [orgId, name, category, lines, vis] of docDefs) {
    const stored = await storeDemoPdf(orgId, name, name.replace(/\.pdf$/, ""), lines);
    if (!stored) continue;
    const id = uuidv7();
    await db.insert(documents).values({
      id,
      groupId: id,
      organisationId: orgId,
      name,
      category,
      storageKey: stored.key,
      contentType: "application/pdf",
      sizeBytes: stored.size,
      uploadedById: founder.id,
      visibility: vis,
    });
  }

  // ---------------------------------------------------------------- Messages
  await db.insert(messages).values([
    {
      organisationId: orgA.id,
      authorId: clientAUser.id,
      fromClient: true,
      body: "Hi Dylan, we've had two calls this week from people who said they found us on Google. Great to see!",
      createdAt: at(-3, 9, 12),
    },
    {
      organisationId: orgA.id,
      authorId: founder.id,
      fromClient: false,
      body: "That's great to hear, Thandi. Could you ask how they found you next time? It helps us attribute enquiries properly. The October article is ready for your approval.",
      createdAt: at(-3, 10, 5),
      readByClientAt: at(-3, 11),
    },
    {
      organisationId: orgB.id,
      authorId: clientBUser.id,
      fromClient: true,
      kind: "support",
      subject: "Invoice query",
      body: "Our finance team is asking for a copy of the September invoice with our PO number.",
      createdAt: at(-2, 14),
    },
  ]);

  // ---------------------------------------------------------------- Leads & pipeline
  const [acacia, blueCrane, summit, kloof, ridgeback] = await db
    .insert(leads)
    .values([
      {
        company: "Acacia Legal Advisory (Demo)",
        website: "https://acacia-legal.example",
        contactName: "Naledi Mokoena (Demo)",
        email: "naledi@acacia-legal.example",
        industry: "Legal (commercial law)",
        location: "Pretoria",
        employeeRange: "11-50",
        goal: "More enquiries from growing businesses",
        source: "visibility_report",
        stage: "new",
        consentAt: at(-1),
        consentText: "Demo consent",
        isDemo: true,
        estimatedMonthlyMinor: 1300000,
        ownerId: founder.id,
        createdAt: at(-1, 8),
      },
      {
        company: "Blue Crane Logistics (Demo)",
        website: "https://bluecrane-logistics.example",
        contactName: "Johan Botha (Demo)",
        contactRole: "Commercial Director",
        email: "johan@bluecrane-logistics.example",
        industry: "Logistics",
        location: "Johannesburg",
        employeeRange: "51-200",
        goal: "Generate more leads from manufacturers",
        source: "visibility_report",
        stage: "call_booked",
        consentAt: at(-6),
        consentText: "Demo consent",
        isDemo: true,
        estimatedMonthlyMinor: 1850000,
        ownerId: founder.id,
        createdAt: at(-6, 10),
      },
      {
        company: "Summit Fire Protection (Demo)",
        website: "https://summit-fire.example",
        contactName: "Lerato Dlamini (Demo)",
        contactRole: "Owner",
        email: "lerato@summit-fire.example",
        industry: "Fire protection (specialist contractor)",
        location: "Midrand",
        employeeRange: "11-50",
        goal: "Win more commercial maintenance contracts",
        source: "referral",
        stage: "proposal_sent",
        isDemo: true,
        estimatedMonthlyMinor: 1650000,
        ownerId: founder.id,
        createdAt: at(-20, 10),
      },
      {
        company: "Kloof Street Bistro (Demo)",
        website: "https://kloof-bistro.example",
        contactName: "Sam Jacobs (Demo)",
        email: "sam@kloof-bistro.example",
        industry: "Hospitality (restaurant)",
        location: "Cape Town",
        employeeRange: "11-50",
        source: "contact_form",
        stage: "nurture",
        isDemo: true,
        ownerId: founder.id,
        createdAt: at(-14, 10),
        message: "Looking for help with Instagram posts.",
      },
      {
        company: "Ridgeback Software (Demo)",
        website: "https://ridgeback-software.example",
        contactName: "Ayesha Khan (Demo)",
        email: "ayesha@ridgeback-software.example",
        industry: "Technology (software)",
        location: "Cape Town",
        employeeRange: "11-50",
        goal: "Automate our reporting",
        source: "contact_form",
        stage: "new",
        isDemo: true,
        ownerId: null,
        createdAt: at(0, 7),
        message: "We'd like to automate client reporting and understand AI options.",
      },
    ])
    .returning();
  await db.insert(leadActivities).values([
    {
      leadId: blueCrane.id,
      type: "call",
      summary: "Discovery call booked from the Visibility Report page.",
      createdAt: at(-5),
    },
    {
      leadId: summit.id,
      type: "meeting",
      summary:
        "Strategy call held. Needs: maintenance contract leads, weak Google presence outside Midrand.",
      createdAt: at(-9),
    },
    {
      leadId: summit.id,
      type: "proposal",
      summary: "Proposal MCP-2026-0001 sent.",
      createdAt: at(-7),
    },
    {
      leadId: kloof.id,
      type: "note",
      summary: "Outside core focus (hospitality, consumer). Moved to nurture with a polite reply.",
      createdAt: at(-13),
    },
  ]);

  // Visibility snapshots produced by the real engine from offline demo fixtures.
  for (const lead of [acacia, blueCrane, summit, kloof, ridgeback]) {
    const [audit] = await db
      .insert(audits)
      .values({
        leadId: lead.id,
        kind: "visibility",
        url: `${lead.website}/`,
        companyName: lead.company,
        publicToken: randomToken(18),
      })
      .returning();
    await processAudit(db, audit.id, fixtureFetcher);
  }
  // processAudit moved new leads to audit_generated; restore the intended demo stages.
  await db.update(leads).set({ stage: "call_booked" }).where(eq(leads.id, blueCrane.id));
  await db.update(leads).set({ stage: "proposal_sent" }).where(eq(leads.id, summit.id));
  await db.update(leads).set({ stage: "nurture" }).where(eq(leads.id, kloof.id));

  // Client audits (with competitors) through the same engine.
  const [clientAudit] = await db
    .insert(audits)
    .values({
      organisationId: orgA.id,
      kind: "visibility",
      url: "https://harbourline-engineering.example/",
      companyName: "Harbourline Engineering (Demo)",
      publicToken: randomToken(18),
      requestedById: founder.id,
    })
    .returning();
  await processAudit(db, clientAudit.id, fixtureFetcher);

  // ---------------------------------------------------------------- Meetings
  await db.insert(meetings).values([
    {
      leadId: blueCrane.id,
      type: "discovery",
      title: "Discovery call: Blue Crane Logistics (Demo)",
      startsAt: at(1, 10),
      endsAt: at(1, 10, 30),
      hostId: founder.id,
      meetingUrl: "https://meet.example.test/blue-crane",
      attendees: [{ name: "Johan Botha (Demo)", email: "johan@bluecrane-logistics.example" }],
    },
    {
      organisationId: orgB.id,
      type: "client",
      title: "Billing & Google Ads check-in: Veldt (Demo)",
      startsAt: at(0, 14),
      endsAt: at(0, 14, 30),
      hostId: founder.id,
      meetingUrl: "https://meet.example.test/veldt",
      attendees: [{ name: "Pieter van Wyk (Demo)", email: DEMO_ACCOUNTS.clientB.email }],
    },
    {
      organisationId: orgA.id,
      type: "monthly_review",
      title: "Monthly review: Harbourline (Demo)",
      startsAt: at(3, 11),
      endsAt: at(3, 11, 30),
      hostId: founder.id,
      meetingUrl: "https://meet.example.test/harbourline",
      attendees: [{ name: DEMO_ACCOUNTS.clientA.name, email: DEMO_ACCOUNTS.clientA.email }],
    },
    {
      leadId: summit.id,
      type: "strategy",
      title: "Strategy call: Summit Fire Protection (Demo)",
      startsAt: at(-9, 10),
      endsAt: at(-9, 10, 45),
      status: "completed",
      hostId: founder.id,
      notes:
        "Lerato wants more commercial maintenance contracts. Most work comes from referrals. Google presence weak outside Midrand. Budget around R15k-R18k/month. Wants to start next month.",
      outcome: {
        generatedAt: at(-9, 11).toISOString(),
        summary:
          "Owner-led fire protection contractor wants predictable commercial maintenance contracts beyond referrals.",
        needs: [
          "Visibility for commercial fire maintenance searches across Gauteng",
          "Structured outreach to facilities managers",
        ],
        goals: ["10 new maintenance contracts in 12 months"],
        budget: "R15,000 to R18,000 per month (as discussed)",
        timeline: "Start next month",
        objections: ["Previous agency produced reports but no enquiries"],
        servicesDiscussed: ["SEO", "AEO", "Lead generation"],
        nextSteps: ["Send proposal within 3 days", "Share example monthly report"],
        followUpEmail: "Hi Lerato, thank you for your time today...",
      },
    },
    {
      type: "internal",
      title: "Weekly planning (Mea Creo)",
      startsAt: at(0, 8, 30),
      endsAt: at(0, 9),
      hostId: founder.id,
    },
  ]);

  // ---------------------------------------------------------------- Proposal
  const proposalServices = ["seo", "aeo", "lead-generation"];
  const [proposal] = await db
    .insert(proposals)
    .values({
      leadId: summit.id,
      number: "MCP-2026-0001",
      title: "Visibility & lead generation for Summit Fire Protection",
      companyName: "Summit Fire Protection (Demo)",
      contactName: "Lerato Dlamini (Demo)",
      contactEmail: "lerato@summit-fire.example",
      status: "sent",
      publicToken: randomToken(18),
      summary:
        "A six-month programme to make Summit Fire Protection the visible, credible choice for commercial fire maintenance across Gauteng, and to open conversations with facilities managers directly.",
      problems: [
        "Most new work comes from referrals, which is unpredictable",
        "Limited Google visibility outside Midrand",
        "No structured way to reach facilities managers",
      ],
      goals: [
        "Consistent commercial maintenance enquiries",
        "Visibility for key searches across Gauteng",
        "10 new maintenance contracts in 12 months",
      ],
      activities: [
        "Technical and on-page SEO for service pages",
        "Answering the top buyer questions (compliance, inspection intervals, costs)",
        "Monthly prospect research and approved outreach to facilities managers",
        "Monthly report: what we did, what changed, what's next",
      ],
      kpis: [
        "Organic enquiries per month",
        "Visibility for priority searches",
        "Meetings booked from outreach",
      ],
      timeline:
        "Month 1: foundations and outreach list. Months 2 to 3: content and first outreach waves. Months 4 to 6: scale what works.",
      assumptions:
        "Access to the website CMS and Google Search Console. Outreach messages are approved by Summit before sending.",
      terms:
        "Six-month minimum term, then month to month with 30 days' notice. Setup fees are due on acceptance. Monthly fees are billed in advance. (Demo terms: to be reviewed by an attorney.)",
      contractMonths: 6,
      validUntil: at(14),
      sentAt: at(-7),
      viewedAt: at(-6),
      createdById: founder.id,
    })
    .returning();
  await db.insert(proposalItems).values(
    proposalServices.map((slug, i) => ({
      proposalId: proposal.id,
      serviceId: svc.get(slug)!.id,
      name: svc.get(slug)!.name,
      description: svc.get(slug)!.summary,
      setupMinor: price(slug)?.setupMinor ?? 0,
      monthlyMinor: price(slug)?.monthlyMinor ?? 0,
      sortOrder: i,
    })),
  );
  await db.insert(proposalItems).values({
    proposalId: proposal.id,
    serviceId: svc.get("geo")!.id,
    name: svc.get("geo")!.name,
    description: svc.get("geo")!.summary,
    monthlyMinor: price("geo")?.monthlyMinor ?? 0,
    optional: true,
    sortOrder: 9,
  });

  // Demo site shows the starter articles as published.
  await db.update(insights).set({ status: "published", publishedAt: at(-20) });

  // Run the real engines over the demo data so every screen shows genuine output.
  const { createRun, executeRun } = await import("@/modules/runs/engine");
  const { recomputeHealth } = await import("@/modules/clients/health");
  const { refreshClientOpportunities } = await import("@/modules/growth/opportunities");
  const { generateMeetingBriefing } = await import("@/modules/meetings/briefing");
  const { processDomainEvents } = await import("@/modules/workflows/engine");
  const { jobs, meetings: meetingsTable } = await import("@/db/schema");

  const growthRun = await createRun(db, {
    organisationId: orgA.id,
    kind: "client_growth_review",
    triggeredById: founder.id,
  });
  await executeRun(db, growthRun, { fetcher: fixtureFetcher });
  const internal = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, "mea-creo-growth"));
  if (internal[0]) {
    const leadRun = await createRun(db, {
      organisationId: internal[0].id,
      kind: "lead_opportunity_scan",
      triggeredById: founder.id,
    });
    await executeRun(db, leadRun);
  }
  for (const orgId of [orgA.id, orgB.id]) {
    await refreshClientOpportunities(db, orgId, "demo-seed");
    await recomputeHealth(db, orgId);
  }
  for (const m of await db
    .select({ id: meetingsTable.id })
    .from(meetingsTable)
    .where(eq(meetingsTable.status, "scheduled"))) {
    await generateMeetingBriefing(db, m.id);
  }
  await processDomainEvents(db);
  // Jobs queued during seeding (e.g. briefings) were executed inline above.
  await db.delete(jobs);
}
