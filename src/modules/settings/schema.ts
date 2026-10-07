import { z } from "zod";
import { siteConfig } from "@/config/site";

/**
 * Every admin-configurable setting, with its validation and default.
 * Stored per organisation in the `settings` table (see ./service.ts).
 */
export const settingsSchemas = {
  company: z.object({
    legalName: z.string().min(1),
    tradingName: z.string().min(1),
    email: z.email(),
    phone: z.string(),
    streetAddress: z.string().optional(),
    locality: z.string(),
    region: z.string(),
    postalCode: z.string().optional(),
    country: z.string(),
    registrationNumber: z.string().optional(),
    vatNumber: z.string().optional(),
    linkedinUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    facebookUrl: z.string().optional(),
    detailsVerified: z.boolean(),
  }),
  brand: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  billing: z.object({
    defaultCurrency: z.string().length(3),
    vatRegistered: z.boolean(),
    taxRatePercent: z.number().min(0).max(50),
    paymentTermsDays: z.number().int().min(0).max(90),
    /** Days after the due date before services are paused. */
    pauseAfterOverdueDays: z.number().int().min(0).max(120),
    reminderDaysAfterDue: z.array(z.number().int().min(0)).max(5),
    invoicePrefix: z.string().min(1).max(8),
    proposalPrefix: z.string().min(1).max(8),
    /** Seeded demo prices are marked so they can never be mistaken for real pricing. */
    pricesAreDemo: z.boolean(),
    /** Show the package prices on the public website (/pricing and the home page). */
    showPricesPublicly: z.boolean().default(true),
  }),
  booking: z.object({
    timezone: z.string(),
    workingDays: z.array(z.number().int().min(0).max(6)),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeHours: z.number().int().min(0).max(240),
    /** Earliest booking is this many business days (Mon–Fri) after today. 0 = hours rule only. */
    minNoticeBusinessDays: z.number().int().min(0).max(20).default(1),
    /** Discovery (visibility review) calls only on these days; other meetings use workingDays. */
    discoveryDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3]),
    /** Maximum meetings booked through the booking pages per day. 0 = no limit. */
    maxBookingsPerDay: z.number().int().min(0).max(20).default(3),
    horizonDays: z.number().int().min(1).max(90),
    durations: z.object({
      discovery: z.number().int(),
      strategy: z.number().int(),
      onboarding: z.number().int(),
      monthly_review: z.number().int(),
      client: z.number().int(),
      internal: z.number().int(),
    }),
  }),
  ai: z.object({
    monthlyBudgetUsd: z.number().min(0),
    perClientMonthlyBudgetUsd: z.number().min(0),
    maxStepsPerRun: z.number().int().min(1).max(50),
    /** Runs estimated to cost more than this need a human to approve first. */
    approvalThresholdUsd: z.number().min(0),
  }),
  automation: z.object({
    /** Overrides of the default approval level per action type. Hard-locked actions ignore overrides. */
    approvalOverrides: z.record(z.string(), z.enum(["automatic", "client", "internal", "manual"])),
    monthlyCycleDay: z.number().int().min(1).max(28),
    autoGenerateBriefings: z.boolean(),
  }),
  emergency: z.object({
    pauseAllAutomation: z.boolean(),
    pauseOutboundEmail: z.boolean(),
    pausePayments: z.boolean(),
    pausedAgents: z.array(z.string()),
  }),
  targets: z.object({
    targetMonthlyRevenueMinor: z.number().int().nullable(),
    targetMrrMinor: z.number().int().nullable(),
    monthlyOperatingCostsMinor: z.number().int().nullable(),
    desiredMarginPercent: z.number().nullable(),
    /** Internal floor: below this monthly value a client isn't viable. Never published. */
    minimumMonthlyValueMinor: z.number().int().nullable().default(null),
    targetAverageClientValueMinor: z.number().int().nullable().default(null),
    targetNewClientsPerMonth: z.number().int().nullable().default(null),
    /** How many clients Dylan can personally serve before delegating. */
    clientCapacity: z.number().int().nullable().default(null),
  }),
  /** Ideal-client rules used to qualify prospects (handoff §8, §24). */
  qualification: z.object({
    targetIndustries: z.array(z.string()),
    poorFitSignals: z.array(z.string()),
    idealEmployeeRanges: z.array(z.string()),
    decisionMakerRoles: z.array(z.string()),
  }),
  /** Outreach safety limits (handoff §25). */
  outreach: z.object({
    /** Maximum outbound messages sent per day, all channels. No mass messaging. */
    maxPerDay: z.number().int().min(1).max(100),
    senderName: z.string(),
    senderTitle: z.string(),
  }),
  /** Which legal pages the director has confirmed were reviewed (removes the draft notice). */
  legal: z.object({
    reviewed: z.object({
      popia: z.boolean(),
      privacy: z.boolean(),
      terms: z.boolean(),
      cookies: z.boolean(),
    }),
  }),
  setup: z.object({ completedSteps: z.array(z.string()) }),
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export type Settings<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;

export const settingsDefaults: { [K in SettingsKey]: Settings<K> } = {
  company: {
    legalName: siteConfig.legalName,
    tradingName: siteConfig.name,
    email: siteConfig.contact.email,
    phone: siteConfig.contact.phone,
    streetAddress: siteConfig.contact.streetAddress,
    locality: siteConfig.contact.locality,
    region: siteConfig.contact.region,
    postalCode: siteConfig.contact.postalCode,
    country: siteConfig.contact.country,
    registrationNumber: siteConfig.registrationNumber,
    linkedinUrl: "https://www.linkedin.com/in/mea-creo-011657239/",
    instagramUrl: "https://www.instagram.com/meacreo/",
    facebookUrl: "https://www.facebook.com/profile.php?id=61565803731608",
    // Supplied by the director in the Master Build handoff.
    detailsVerified: true,
  },
  brand: { primaryColor: "#4a6b58", accentColor: "#6b8971" },
  billing: {
    defaultCurrency: "ZAR",
    // Not VAT-registered until confirmed. See the owner handbook.
    vatRegistered: false,
    taxRatePercent: 0,
    paymentTermsDays: 7,
    pauseAfterOverdueDays: 14,
    reminderDaysAfterDue: [1, 7],
    invoicePrefix: "MC",
    proposalPrefix: "MCP",
    pricesAreDemo: false,
    showPricesPublicly: true,
  },
  booking: {
    timezone: "Africa/Johannesburg",
    workingDays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 16,
    bufferMinutes: 15,
    minNoticeHours: 20,
    minNoticeBusinessDays: 1,
    discoveryDays: [1, 2, 3],
    maxBookingsPerDay: 3,
    horizonDays: 21,
    durations: {
      discovery: 30,
      strategy: 45,
      onboarding: 60,
      monthly_review: 30,
      client: 30,
      internal: 30,
    },
  },
  ai: {
    monthlyBudgetUsd: 50,
    perClientMonthlyBudgetUsd: 10,
    maxStepsPerRun: 8,
    approvalThresholdUsd: 1,
  },
  automation: { approvalOverrides: {}, monthlyCycleDay: 1, autoGenerateBriefings: true },
  emergency: {
    pauseAllAutomation: false,
    pauseOutboundEmail: false,
    pausePayments: false,
    pausedAgents: [],
  },
  // From the Master Build handoff (approved by the director).
  targets: {
    targetMonthlyRevenueMinor: 10_000_000, // R100,000 a month
    targetMrrMinor: null,
    monthlyOperatingCostsMinor: null,
    desiredMarginPercent: null,
    minimumMonthlyValueMinor: 550_000, // R5,500 internal floor
    targetAverageClientValueMinor: 800_000, // R8,000
    targetNewClientsPerMonth: 3, // 2–3
    clientCapacity: 10, // 8–10
  },
  qualification: {
    targetIndustries: [
      "mining",
      "electrical",
      "engineering",
      "construction",
      "industrial",
      "manufacturing",
      "corporate",
      "professional services",
      "business services",
      "sales",
      "product",
      "technical",
      "specialist",
      "b2b",
      "logistics",
      "legal",
      "accounting",
      "consulting",
      "technology",
      "software",
      "financial services",
      "fire protection",
      "security",
      "architecture",
    ],
    poorFitSignals: ["cheap", "free work", "lowest price", "no budget", "just a quick", "for free"],
    idealEmployeeRanges: ["11-50", "51-200", "201-1000", "10-50", "50-200"],
    decisionMakerRoles: [
      "owner",
      "founder",
      "director",
      "managing director",
      "ceo",
      "chief executive",
      "general manager",
      "gm",
      "head of marketing",
      "marketing manager",
      "marketing director",
      "sales director",
      "business development",
      "partner",
    ],
  },
  outreach: { maxPerDay: 15, senderName: "Dylan Metcalf", senderTitle: "Founder, Mea Creo" },
  legal: { reviewed: { popia: false, privacy: false, terms: false, cookies: false } },
  setup: { completedSteps: [] },
};
