import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { services } from "@/db/schema";
import { PACKAGE_SLUGS } from "@/modules/services/catalogue";
import { getPlatformSetting } from "@/modules/settings/service";

export interface PublicPackage {
  slug: string;
  name: string;
  summary: string;
  description: string;
  includes: string[];
  billingType: string;
  /** ZAR minor units; null for custom quotations. */
  priceMinor: number | null;
  period: "once-off" | "month" | null;
}

/**
 * The approved packages, priced from the live catalogue (Services & pricing), in display
 * order. Returns null when the owner has chosen not to show prices publicly.
 */
export async function getPublicPackages(db: DbOrTx): Promise<PublicPackage[] | null> {
  const billing = await getPlatformSetting(db, "billing");
  if (!billing.showPricesPublicly) return null;
  const rows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.category, "package"),
        eq(services.status, "active"),
        eq(services.showOnWebsite, true),
        inArray(services.slug, [...PACKAGE_SLUGS]),
      ),
    );
  return rows
    .sort((a, b) => PACKAGE_SLUGS.indexOf(a.slug as never) - PACKAGE_SLUGS.indexOf(b.slug as never))
    .map((s) => {
      const p = s.prices.ZAR ?? {};
      const priceMinor =
        s.billingType === "monthly"
          ? (p.monthlyMinor ?? null)
          : s.billingType === "once_off"
            ? (p.oneOffMinor ?? null)
            : null;
      return {
        slug: s.slug,
        name: s.name,
        summary: s.summary,
        description: s.description,
        includes: s.includedActivities,
        billingType: s.billingType,
        priceMinor: priceMinor || null,
        period:
          s.billingType === "monthly" ? "month" : s.billingType === "once_off" ? "once-off" : null,
      };
    });
}

/** "R8,500": whole rands, as the business quotes them. */
export function formatRand(minor: number): string {
  return `R${Math.round(minor / 100)
    .toLocaleString("en-ZA")
    .replace(/\s| /g, ",")}`;
}
