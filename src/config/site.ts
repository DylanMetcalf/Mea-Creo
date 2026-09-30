/**
 * Public-facing company details.
 *
 * These are defaults migrated from the previous Wix site (https://www.meacreo.co.za/,
 * captured 2026-09-30). They move into admin-editable settings in Phase 6.
 * TODO(before production): Dylan to verify every value below.
 */
export const siteConfig = {
  legalName: "Mea Creo (Pty) Ltd",
  name: "Mea Creo",
  tagline: "Get found. Get noticed. Grow.",
  description:
    "Mea Creo helps businesses become more visible online, generate better opportunities and build the digital systems that turn attention into growth.",
  contact: {
    email: "dylan@meacreo.co.za",
    phone: "+27 79 889 5569",
    locality: "Pretoria",
    region: "Gauteng",
    country: "South Africa",
    countryCode: "ZA",
  },
  defaultCurrency: "ZAR",
  defaultLocale: "en-ZA",
} as const;
