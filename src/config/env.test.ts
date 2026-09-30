import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "./env";

const productionBase = {
  APP_ENV: "production",
  DATABASE_URL: "postgres://u:p@db/meacreo",
  AUTH_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: "k".repeat(44),
  AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "sk-test",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_test",
  STORAGE_PROVIDER: "s3",
  S3_BUCKET: "b",
  S3_ACCESS_KEY_ID: "a",
  S3_SECRET_ACCESS_KEY: "s",
  PAYMENT_PROVIDER: "none",
  CALENDAR_PROVIDER: "none",
  ANALYTICS_PROVIDER: "none",
  SEARCH_PROVIDER: "none",
};

function issuesOf(source: Record<string, string>): string[] {
  try {
    parseEnv(source);
    return [];
  } catch (error) {
    if (error instanceof EnvValidationError) return error.issues;
    throw error;
  }
}

describe("parseEnv", () => {
  it("defaults to a safe development configuration using mock adapters", () => {
    const env = parseEnv({});
    expect(env.APP_ENV).toBe("development");
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.ACCOUNTING_PROVIDER).toBe("none");
    expect(env.FEATURE_XERO).toBe(false);
  });

  it("parses boolean flags", () => {
    expect(parseEnv({ FEATURE_GSC: "true" }).FEATURE_GSC).toBe(true);
    expect(parseEnv({ FEATURE_GSC: "1" }).FEATURE_GSC).toBe(true);
    expect(parseEnv({ FEATURE_GSC: "false" }).FEATURE_GSC).toBe(false);
  });

  it("accepts a complete production configuration", () => {
    expect(issuesOf(productionBase)).toEqual([]);
  });

  it("requires core secrets in production and staging", () => {
    for (const APP_ENV of ["production", "staging"]) {
      const issues = issuesOf({ ...productionBase, APP_ENV, DATABASE_URL: "", AUTH_SECRET: "" });
      expect(issues.some((i) => i.startsWith("DATABASE_URL"))).toBe(true);
      expect(issues.some((i) => i.startsWith("AUTH_SECRET"))).toBe(true);
    }
  });

  it("refuses mock adapters in production", () => {
    const issues = issuesOf({ ...productionBase, PAYMENT_PROVIDER: "mock" });
    expect(issues).toContain(
      "PAYMENT_PROVIDER: PAYMENT_PROVIDER=mock is not allowed in production",
    );
  });

  it("allows mock adapters in staging", () => {
    expect(issuesOf({ ...productionBase, APP_ENV: "staging", PAYMENT_PROVIDER: "mock" })).toEqual(
      [],
    );
  });

  it("requires provider credentials when a real provider is selected", () => {
    const issues = issuesOf({ PAYMENT_PROVIDER: "payfast", ACCOUNTING_PROVIDER: "xero" });
    expect(issues.map((i) => i.split(":")[0])).toEqual(
      expect.arrayContaining([
        "PAYFAST_MERCHANT_ID",
        "PAYFAST_MERCHANT_KEY",
        "PAYFAST_PASSPHRASE",
        "XERO_CLIENT_ID",
        "XERO_CLIENT_SECRET",
        "ENCRYPTION_KEY",
      ]),
    );
  });

  it("requires Google OAuth credentials for any Google integration", () => {
    const issues = issuesOf({ SEARCH_PROVIDER: "google" });
    expect(issues.some((i) => i.startsWith("GOOGLE_CLIENT_ID"))).toBe(true);
  });

  it("rejects unknown provider ids", () => {
    expect(issuesOf({ PAYMENT_PROVIDER: "stripe" }).length).toBeGreaterThan(0);
  });
});
