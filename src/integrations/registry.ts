import { getEnv, type Env } from "@/config/env";
import { AppError } from "@/lib/errors";
import { MockAccountingProvider } from "./accounting/mock";
import type { AccountingProvider } from "./accounting/types";
import { MockAIProvider } from "./ai/mock";
import type { AIProvider } from "./ai/types";
import { MockAnalyticsProvider } from "./analytics/mock";
import type { AnalyticsProvider } from "./analytics/types";
import { MockCalendarProvider } from "./calendar/mock";
import type { CalendarProvider } from "./calendar/types";
import { MockCRMProvider } from "./crm/mock";
import type { CRMProvider } from "./crm/types";
import { MockEmailProvider } from "./email/mock";
import type { EmailProvider } from "./email/types";
import { MockPaymentProvider } from "./payments/mock";
import type { PaymentProvider } from "./payments/types";
import { MockSearchProvider } from "./search/mock";
import type { SearchProvider } from "./search/types";
import { MockSocialProvider } from "./social/mock";
import type { SocialProvider } from "./social/types";
import { LocalStorageProvider } from "./storage/local";
import { MockStorageProvider } from "./storage/mock";
import { S3StorageProvider } from "./storage/s3";
import { ResendEmailProvider, SmtpEmailProvider } from "./email/providers";
import type { StorageProvider } from "./storage/types";
import { INTEGRATION_KINDS, type IntegrationHealth, type IntegrationKind } from "./types";

export interface AdapterMap {
  payments: PaymentProvider;
  accounting: AccountingProvider;
  calendar: CalendarProvider;
  analytics: AnalyticsProvider;
  search: SearchProvider;
  ai: AIProvider;
  email: EmailProvider;
  storage: StorageProvider;
  crm: CRMProvider;
  social: SocialProvider;
}

type Factory<K extends IntegrationKind> = (env: Env) => AdapterMap[K];

/**
 * Registered adapter factories per integration kind, keyed by provider id.
 * A provider id that is valid in the environment but absent here has no adapter
 * yet: it reports NOT_CONNECTED instead of pretending to work. Real adapters are
 * registered here as each build phase lands (see docs/INTEGRATIONS.md).
 */
const factories: { [K in IntegrationKind]: Partial<Record<string, Factory<K>>> } = {
  payments: {
    mock: (env) => new MockPaymentProvider(`${env.NEXT_PUBLIC_SITE_URL}/dev/mock-checkout`),
  },
  accounting: { mock: () => new MockAccountingProvider() },
  calendar: { mock: () => new MockCalendarProvider() },
  analytics: { mock: () => new MockAnalyticsProvider() },
  search: { mock: () => new MockSearchProvider() },
  ai: { mock: () => new MockAIProvider() },
  email: {
    mock: () => new MockEmailProvider(),
    resend: (env) => new ResendEmailProvider(env.RESEND_API_KEY!, env.EMAIL_FROM),
    smtp: (env) => new SmtpEmailProvider(env.SMTP_URL!, env.EMAIL_FROM),
  },
  storage: {
    mock: (env) => new MockStorageProvider(`${env.NEXT_PUBLIC_SITE_URL}/dev/mock-storage`),
    local: () => new LocalStorageProvider(),
    s3: (env) =>
      new S3StorageProvider({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET!,
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      }),
  },
  crm: { mock: () => new MockCRMProvider() },
  social: { mock: () => new MockSocialProvider() },
};

const PROVIDER_ENV_KEY = {
  payments: "PAYMENT_PROVIDER",
  accounting: "ACCOUNTING_PROVIDER",
  calendar: "CALENDAR_PROVIDER",
  analytics: "ANALYTICS_PROVIDER",
  search: "SEARCH_PROVIDER",
  ai: "AI_PROVIDER",
  email: "EMAIL_PROVIDER",
  storage: "STORAGE_PROVIDER",
  crm: "CRM_PROVIDER",
  social: "SOCIAL_PROVIDER",
} as const satisfies Record<IntegrationKind, keyof Env>;

export function configuredProvider(kind: IntegrationKind, env: Env): string {
  return env[PROVIDER_ENV_KEY[kind]];
}

export type Resolution<K extends IntegrationKind> =
  { available: true; adapter: AdapterMap[K] } | { available: false; health: IntegrationHealth };

// Adapters are cached per process so mock state survives across requests in development.
const cache = new Map<string, AdapterMap[IntegrationKind]>();

export function resolveIntegration<K extends IntegrationKind>(
  kind: K,
  env: Env = getEnv(),
): Resolution<K> {
  const provider = configuredProvider(kind, env);
  const unavailable = (message: string): Resolution<K> => ({
    available: false,
    health: {
      kind,
      provider,
      status: "NOT_CONNECTED",
      mock: false,
      message,
      checkedAt: new Date(),
    },
  });

  if (provider === "none") return unavailable("Not connected.");
  if (provider === "mock" && env.APP_ENV === "production") {
    return unavailable("Mock adapters are disabled in production.");
  }

  const factory = factories[kind][provider] as Factory<K> | undefined;
  if (!factory) {
    return unavailable(`The ${provider} integration is not available in this version yet.`);
  }

  const cacheKey = `${kind}:${provider}`;
  let adapter = cache.get(cacheKey) as AdapterMap[K] | undefined;
  if (!adapter) {
    adapter = factory(env);
    cache.set(cacheKey, adapter);
  }
  return { available: true, adapter };
}

/** Returns the adapter or throws a user-safe INTEGRATION_NOT_CONNECTED error. */
export function getIntegration<K extends IntegrationKind>(
  kind: K,
  env: Env = getEnv(),
): AdapterMap[K] {
  const resolution = resolveIntegration(kind, env);
  if (!resolution.available) {
    throw new AppError("INTEGRATION_NOT_CONNECTED", {
      message: `${kind} integration unavailable: ${resolution.health.message}`,
      details: { kind, provider: resolution.health.provider },
    });
  }
  return resolution.adapter;
}

/** Health for every integration kind, for the admin integration-health view. */
export async function integrationHealth(env: Env = getEnv()): Promise<IntegrationHealth[]> {
  return Promise.all(
    INTEGRATION_KINDS.map(async (kind) => {
      const resolution = resolveIntegration(kind, env);
      if (!resolution.available) return resolution.health;
      try {
        return await resolution.adapter.healthCheck();
      } catch (error) {
        return {
          kind,
          provider: resolution.adapter.provider,
          status: "ERROR" as const,
          mock: resolution.adapter.isMock,
          message: error instanceof Error ? error.message : "Health check failed.",
          checkedAt: new Date(),
        };
      }
    }),
  );
}

/** Test helper. */
export function resetIntegrationCache(): void {
  cache.clear();
}
