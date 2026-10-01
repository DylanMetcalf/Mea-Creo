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
    locality: z.string(),
    region: z.string(),
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
    /** Bank details printed on invoices for EFT payment. Entered by the owner; never invented. */
    eftDetails: z.string().max(1000).optional(),
  }),
  booking: z.object({
    timezone: z.string(),
    workingDays: z.array(z.number().int().min(0).max(6)),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    bufferMinutes: z.number().int().min(0).max(120),
    minNoticeHours: z.number().int().min(0).max(240),
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
    locality: siteConfig.contact.locality,
    region: siteConfig.contact.region,
    country: siteConfig.contact.country,
    linkedinUrl: "https://www.linkedin.com/in/mea-creo-011657239/",
    instagramUrl: "https://www.instagram.com/meacreo/",
    facebookUrl: "https://www.facebook.com/profile.php?id=61565803731608",
    detailsVerified: false,
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
  },
  booking: {
    timezone: "Africa/Johannesburg",
    workingDays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 16,
    bufferMinutes: 15,
    minNoticeHours: 20,
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
  targets: {
    targetMonthlyRevenueMinor: null,
    targetMrrMinor: null,
    monthlyOperatingCostsMinor: null,
    desiredMarginPercent: null,
  },
  setup: { completedSteps: [] },
};
