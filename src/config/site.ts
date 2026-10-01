/**
 * Company details, as supplied by the director in the Master Build handoff (2026-10).
 * These are the seed defaults; the live values are edited in Workspace → Settings → Company.
 * Banking details are deliberately NOT here: they are private and entered in Settings,
 * where they are stored encrypted.
 */
export const siteConfig = {
  legalName: "Mea Creo (Pty) Ltd",
  name: "Mea Creo",
  tagline: "Easier to find. Easier to understand. Easier to choose.",
  description:
    "Mea Creo helps businesses become easier to find, easier to understand and easier to choose, through digital visibility, lead generation, content and automation.",
  registrationNumber: "2022/626541/07",
  director: "Dylan Metcalf",
  contact: {
    email: "dylan@meacreo.co.za",
    phone: "+27 79 889 5569",
    streetAddress: "Terram Farm, 58 Tonteldoos Road, Tonteldoos",
    locality: "Dullstroom",
    region: "Mpumalanga",
    postalCode: "1111",
    country: "South Africa",
    countryCode: "ZA",
  },
  defaultCurrency: "ZAR",
  defaultLocale: "en-ZA",
} as const;
