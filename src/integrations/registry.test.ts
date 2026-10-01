import { afterEach, describe, expect, it } from "vitest";
import { parseEnv, type Env } from "@/config/env";
import { AppError } from "@/lib/errors";
import {
  getIntegration,
  integrationHealth,
  resetIntegrationCache,
  resolveIntegration,
} from "./registry";
import { INTEGRATION_KINDS } from "./types";

afterEach(resetIntegrationCache);

describe("integration registry", () => {
  it("serves mock adapters in development", () => {
    const adapter = getIntegration("payments", parseEnv({}));
    expect(adapter.isMock).toBe(true);
    expect(adapter.provider).toBe("mock");
  });

  it("returns the same adapter instance across calls so mock state persists", () => {
    const env = parseEnv({});
    expect(getIntegration("email", env)).toBe(getIntegration("email", env));
  });

  it("reports NOT_CONNECTED for disabled integrations", () => {
    const resolution = resolveIntegration("accounting", parseEnv({}));
    expect(resolution.available).toBe(false);
    if (!resolution.available) expect(resolution.health.status).toBe("NOT_CONNECTED");
  });

  it("does not pretend a configured provider works before its adapter exists", () => {
    const env = parseEnv({ SOCIAL_PROVIDER: "linkedin" });
    const resolution = resolveIntegration("social", env);
    expect(resolution.available).toBe(false);
    if (!resolution.available) {
      expect(resolution.health).toMatchObject({ status: "NOT_CONNECTED", provider: "linkedin" });
    }
  });

  it("throws a user-safe error when an unavailable integration is requested", () => {
    expect(() => getIntegration("accounting", parseEnv({}))).toThrow(AppError);
    try {
      getIntegration("accounting", parseEnv({}));
    } catch (error) {
      expect((error as AppError).code).toBe("INTEGRATION_NOT_CONNECTED");
    }
  });

  it("refuses mock adapters in production even if validation was bypassed", () => {
    const env = { ...parseEnv({}), APP_ENV: "production" } as Env;
    expect(resolveIntegration("payments", env).available).toBe(false);
  });

  it("reports health for every integration kind", async () => {
    const report = await integrationHealth(parseEnv({}));
    expect(report.map((h) => h.kind)).toEqual([...INTEGRATION_KINDS]);
    expect(report.find((h) => h.kind === "ai")).toMatchObject({ status: "CONNECTED", mock: true });
    expect(report.find((h) => h.kind === "accounting")).toMatchObject({ status: "NOT_CONNECTED" });
  });
});
