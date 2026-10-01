import { z } from "zod";

/**
 * Server environment configuration.
 *
 * Every variable is documented in `.env.example` and docs/ENVIRONMENT.md.
 * Parsing is lazy (see `getEnv`) so that `next build` does not require
 * runtime secrets, but any code path that needs configuration fails fast
 * with a readable message if it is missing or invalid.
 */

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const APP_ENVS = ["development", "test", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const envSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVS).default("development"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),

    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

    DATABASE_URL: optionalString,

    AUTH_SECRET: optionalString,
    /** 32-byte base64 key used to encrypt integration tokens at rest. */
    ENCRYPTION_KEY: optionalString,

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    AI_PROVIDER: z.enum(["none", "mock", "anthropic", "openai", "google"]).default("mock"),
    AI_MODEL: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    GOOGLE_AI_API_KEY: optionalString,
    AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(50),

    EMAIL_PROVIDER: z.enum(["mock", "smtp", "resend"]).default("mock"),
    EMAIL_FROM: z.string().default("Mea Creo <no-reply@meacreo.co.za>"),
    SMTP_URL: optionalString,
    RESEND_API_KEY: optionalString,

    STORAGE_PROVIDER: z.enum(["mock", "local", "s3"]).default("local"),
    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,

    PAYMENT_PROVIDER: z.enum(["none", "mock", "payfast"]).default("mock"),
    PAYFAST_MERCHANT_ID: optionalString,
    PAYFAST_MERCHANT_KEY: optionalString,
    PAYFAST_PASSPHRASE: optionalString,
    PAYFAST_SANDBOX: bool,

    ACCOUNTING_PROVIDER: z.enum(["none", "mock", "xero"]).default("none"),
    XERO_CLIENT_ID: optionalString,
    XERO_CLIENT_SECRET: optionalString,

    CALENDAR_PROVIDER: z.enum(["none", "mock", "google"]).default("mock"),
    ANALYTICS_PROVIDER: z.enum(["none", "mock", "google"]).default("mock"),
    SEARCH_PROVIDER: z.enum(["none", "mock", "google"]).default("mock"),
    CRM_PROVIDER: z.enum(["none", "mock", "sales_scout"]).default("none"),
    SOCIAL_PROVIDER: z.enum(["none", "mock", "linkedin"]).default("none"),

    SALES_SCOUT_WEBHOOK_SECRET: optionalString,

    FEATURE_XERO: bool,
    FEATURE_PAYFAST: bool,
    FEATURE_GOOGLE_ANALYTICS: bool,
    FEATURE_GSC: bool,
    FEATURE_AI_AUTOMATION: bool,
    FEATURE_SALES_SCOUT: bool,
    FEATURE_CLIENT_AI: bool,
    FEATURE_SELF_SERVICE: bool,
    FEATURE_LINKEDIN: bool,
  })
  .superRefine((env, ctx) => {
    const requireKeys = (keys: (keyof typeof env)[], reason: string) => {
      for (const key of keys) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required ${reason}` });
        }
      }
    };

    if (env.APP_ENV === "production" || env.APP_ENV === "staging") {
      requireKeys(["DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY"], `when APP_ENV=${env.APP_ENV}`);
    }

    // Mock adapters must never serve real customers.
    if (env.APP_ENV === "production") {
      const providerKeys = [
        "AI_PROVIDER",
        "EMAIL_PROVIDER",
        "STORAGE_PROVIDER",
        "PAYMENT_PROVIDER",
        "ACCOUNTING_PROVIDER",
        "CALENDAR_PROVIDER",
        "ANALYTICS_PROVIDER",
        "SEARCH_PROVIDER",
        "CRM_PROVIDER",
        "SOCIAL_PROVIDER",
      ] as const;
      for (const key of providerKeys) {
        if (env[key] === "mock") {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key}=mock is not allowed in production`,
          });
        }
      }
    }

    if (env.AI_PROVIDER === "anthropic")
      requireKeys(["ANTHROPIC_API_KEY"], "when AI_PROVIDER=anthropic");
    if (env.AI_PROVIDER === "openai") requireKeys(["OPENAI_API_KEY"], "when AI_PROVIDER=openai");
    if (env.AI_PROVIDER === "google") requireKeys(["GOOGLE_AI_API_KEY"], "when AI_PROVIDER=google");
    if (env.EMAIL_PROVIDER === "smtp") requireKeys(["SMTP_URL"], "when EMAIL_PROVIDER=smtp");
    if (env.EMAIL_PROVIDER === "resend")
      requireKeys(["RESEND_API_KEY"], "when EMAIL_PROVIDER=resend");
    if (env.STORAGE_PROVIDER === "s3") {
      requireKeys(
        ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
        "when STORAGE_PROVIDER=s3",
      );
    }
    if (env.PAYMENT_PROVIDER === "payfast") {
      requireKeys(
        ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE"],
        "when PAYMENT_PROVIDER=payfast",
      );
    }
    if (env.ACCOUNTING_PROVIDER === "xero") {
      requireKeys(
        ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "ENCRYPTION_KEY"],
        "when ACCOUNTING_PROVIDER=xero",
      );
    }
    const usesGoogle =
      env.CALENDAR_PROVIDER === "google" ||
      env.ANALYTICS_PROVIDER === "google" ||
      env.SEARCH_PROVIDER === "google";
    if (usesGoogle) {
      requireKeys(
        ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ENCRYPTION_KEY"],
        "when a Google integration is enabled",
      );
    }
    if (env.CRM_PROVIDER === "sales_scout") {
      requireKeys(["SALES_SCOUT_WEBHOOK_SECRET"], "when CRM_PROVIDER=sales_scout");
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "EnvValidationError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((i) =>
        i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
      ),
    );
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper: clears the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
