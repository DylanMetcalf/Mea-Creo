import { count, eq } from "drizzle-orm";
import { getEnv } from "@/config/env";
import { isEnabled } from "@/config/flags";
import type { DbOrTx } from "@/db";
import { organisations } from "@/db/schema";
import { configuredProvider } from "@/integrations/registry";
import { getBankDetails } from "@/modules/banking/service";
import { googleConnection } from "@/modules/integrations/google";
import { getPlatformSetting } from "@/modules/settings/service";

/**
 * The go-live checklist. Automatic items are read from the live configuration; manual
 * items are ticked by the owner. The handoff's rule is built in: the domain is not
 * switched until the new site works, a backup exists, assets are preserved, content is
 * migrated, the domain move is tested and rollback is possible.
 */

export interface LaunchItem {
  key: string;
  label: string;
  detail: string;
  /** Where to fix it. */
  href?: string;
  kind: "auto" | "manual";
  done: boolean;
  /** Recommended but not required to go live. */
  optional?: boolean;
  doneBy?: string;
  doneAt?: string;
}

export interface LaunchGroup {
  key: string;
  title: string;
  description: string;
  items: LaunchItem[];
  /** Locked until every required item in these groups is done. */
  lockedUntil?: string[];
}

export const MANUAL_ITEMS: Record<
  string,
  { group: string; label: string; detail: string; optional?: boolean }
> = {
  wix_backup: {
    group: "safety",
    label: "Wix site backed up",
    detail:
      "Export or save every page, blog post, form and setting from Wix, and keep a copy off Wix.",
  },
  assets_preserved: {
    group: "safety",
    label: "Assets preserved",
    detail: "Original photos, logos and documents downloaded from Wix and stored safely.",
  },
  content_migrated: {
    group: "safety",
    label: "Content migrated and checked",
    detail: "Every page you want to keep exists on the new site and reads correctly.",
  },
  redirects_checked: {
    group: "safety",
    label: "Old links redirect",
    detail: "Old Wix URLs (services, blog, portfolio) land on the right new pages.",
  },
  rollback_ready: {
    group: "safety",
    label: "Rollback possible",
    detail:
      "Current DNS records written down and the DNS TTL lowered a day ahead, so you can switch back within minutes.",
  },
  staging_domain_tested: {
    group: "safety",
    label: "Domain move rehearsed",
    detail:
      "The new site tested on a staging address with HTTPS, email links and payments returning correctly.",
  },
  qa_desktop_mobile: {
    group: "qa",
    label: "Final QA on phone and desktop",
    detail:
      "Every public page, the workspace and the client portal checked on a phone and a computer, in light and dark mode.",
  },
  journey_booking: {
    group: "qa",
    label: "Test booking end to end",
    detail:
      "Book a call on the live configuration and confirm the email, calendar invite and Meet link.",
  },
  journey_report: {
    group: "qa",
    label: "Test Visibility Report end to end",
    detail: "Request a report for a real site and read the result page and PDF.",
  },
  journey_proposal: {
    group: "qa",
    label: "Test proposal, acceptance and payment",
    detail:
      "Send yourself a proposal, accept it, pay the setup invoice (Payfast sandbox or a small live amount) and check onboarding started.",
  },
  dns_switched: {
    group: "golive",
    label: "Domain switched to the new site",
    detail:
      "Point www.meacreo.co.za (and the bare domain) at the new host. Keep email (MX) records unchanged.",
  },
  search_console: {
    group: "after",
    label: "Search Console verified and sitemap submitted",
    detail: "Verify the domain in Google Search Console and submit /sitemap.xml.",
  },
  gbp_link: {
    group: "after",
    label: "Google Business Profile link checked",
    detail: "The website link on your Google Business Profile points to the new site.",
  },
  monitor_week: {
    group: "after",
    label: "First-week monitoring",
    detail: "Check for 404s, form submissions and bookings daily for the first week.",
  },
  wix_retired: {
    group: "after",
    label: "Wix plan retired (after 30 days)",
    detail: "Only once the new site has run cleanly for 30 days and the backup is confirmed.",
    optional: true,
  },
};

export async function launchChecklist(db: DbOrTx): Promise<LaunchGroup[]> {
  const env = getEnv();
  const [company, billing, legal, launch, bank, google, [demo]] = await Promise.all([
    getPlatformSetting(db, "company"),
    getPlatformSetting(db, "billing"),
    getPlatformSetting(db, "legal"),
    getPlatformSetting(db, "launch"),
    getBankDetails(db).catch(() => null),
    googleConnection(db),
    db.select({ n: count() }).from(organisations).where(eq(organisations.isDemo, true)),
  ]);
  const manual = (key: string): LaunchItem => {
    const m = MANUAL_ITEMS[key];
    const done = launch.done[key];
    return {
      key,
      label: m.label,
      detail: m.detail,
      kind: "manual",
      optional: m.optional,
      done: Boolean(done),
      doneBy: done?.by,
      doneAt: done?.at,
    };
  };
  const auto = (
    key: string,
    label: string,
    done: boolean,
    detail: string,
    href?: string,
    optional?: boolean,
  ): LaunchItem => ({ key, label, done, detail, href, kind: "auto", optional });
  const provider = (k: Parameters<typeof configuredProvider>[0]) => configuredProvider(k, env);
  const legalDone = Object.values(legal.reviewed).every(Boolean);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;

  const groups: LaunchGroup[] = [
    {
      key: "business",
      title: "Business details",
      description: "What clients see on invoices, proposals and the website.",
      items: [
        auto(
          "company",
          "Company details confirmed",
          company.detailsVerified,
          "Legal name, registration, address and contact details.",
          "/workspace/settings?tab=company",
        ),
        auto(
          "prices",
          "Real prices set",
          !billing.pricesAreDemo,
          "Package prices match the approved list.",
          "/workspace/services",
        ),
        auto(
          "bank",
          "Bank details stored securely",
          Boolean(bank),
          "Shown only on invoices; stored encrypted, never in code.",
          "/workspace/settings?tab=billing",
        ),
        auto(
          "legal",
          "Legal pages reviewed",
          legalDone,
          "POPIA statement, privacy policy, terms and cookie notice ticked as reviewed (removes the draft notice).",
          "/workspace/settings?tab=company",
        ),
      ],
    },
    {
      key: "config",
      title: "Production configuration",
      description:
        "Read from the server's environment. Secrets are set on the host, never in code.",
      items: [
        auto(
          "env",
          "Running as production",
          env.APP_ENV === "production",
          `APP_ENV is "${env.APP_ENV}".`,
        ),
        auto(
          "url",
          "Site address set",
          /^https:\/\/(www\.)?meacreo\.co\.za\/?$/.test(siteUrl),
          `NEXT_PUBLIC_SITE_URL is ${siteUrl}.`,
        ),
        auto(
          "secrets",
          "Security keys set",
          Boolean(env.AUTH_SECRET && env.ENCRYPTION_KEY),
          "AUTH_SECRET and ENCRYPTION_KEY.",
        ),
        auto(
          "email",
          "Email sending connected",
          ["resend", "smtp"].includes(provider("email")),
          `EMAIL_PROVIDER is "${provider("email")}".`,
          "/workspace/settings?tab=integrations",
        ),
        auto(
          "storage",
          "File storage for production",
          provider("storage") === "s3",
          `STORAGE_PROVIDER is "${provider("storage")}" (use s3 in production).`,
          "/workspace/settings?tab=integrations",
        ),
        auto(
          "payments",
          "Payfast live",
          provider("payments") === "payfast" && !env.PAYFAST_SANDBOX,
          provider("payments") === "payfast"
            ? env.PAYFAST_SANDBOX
              ? "Payfast is in sandbox mode."
              : "Payfast live."
            : `PAYMENT_PROVIDER is "${provider("payments")}". EFT still works without it.`,
          "/workspace/settings?tab=integrations",
          true,
        ),
        auto(
          "cron",
          "Daily cycle scheduled",
          Boolean(env.CRON_SECRET),
          "CRON_SECRET set; vercel.json calls /api/cron/daily each morning.",
        ),
        auto(
          "demo",
          "No demo data",
          Number(demo?.n ?? 0) === 0,
          "Demo organisations are never seeded in production.",
        ),
      ],
    },
    {
      key: "connections",
      title: "Connections",
      description: "Recommended; the site works without them.",
      items: [
        auto(
          "calendar",
          "Google Calendar connected",
          google?.status === "CONNECTED",
          google?.email
            ? `Connected as ${google.email}.`
            : "Bookings then avoid busy times and get Meet links.",
          "/workspace/settings?tab=integrations",
          true,
        ),
        auto(
          "ai",
          "AI provider connected",
          provider("ai") === "anthropic",
          `AI_PROVIDER is "${provider("ai")}". Drafts fall back to rules without it.`,
          "/workspace/settings?tab=integrations",
          true,
        ),
        auto(
          "analytics",
          "Google Analytics (after consent)",
          isEnabled("GOOGLE_ANALYTICS", env) && Boolean(env.GA_MEASUREMENT_ID),
          "FEATURE_GOOGLE_ANALYTICS and GA_MEASUREMENT_ID.",
          undefined,
          true,
        ),
      ],
    },
  ];
  const byGroup = (g: string) =>
    Object.entries(MANUAL_ITEMS)
      .filter(([, m]) => m.group === g)
      .map(([k]) => manual(k));
  groups.push(
    {
      key: "safety",
      title: "Protect the current website",
      description: "The Wix site stays live until all of this is done.",
      items: byGroup("safety"),
    },
    {
      key: "qa",
      title: "Final QA",
      description: "Real journeys, start to finish.",
      items: byGroup("qa"),
    },
    {
      key: "golive",
      title: "Go live",
      description: "Unlocks when everything above is done.",
      items: byGroup("golive"),
      lockedUntil: ["business", "config", "safety", "qa"],
    },
    {
      key: "after",
      title: "After launch",
      description: "The first month.",
      items: byGroup("after"),
    },
  );
  return groups;
}

/** Whether a group's prerequisites are met. */
export function isUnlocked(group: LaunchGroup, all: LaunchGroup[]): boolean {
  return (group.lockedUntil ?? []).every((key) =>
    (all.find((g) => g.key === key)?.items ?? []).every((i) => i.done || i.optional),
  );
}
