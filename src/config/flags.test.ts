import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
import { allFlags, isEnabled } from "./flags";

describe("feature flags", () => {
  it("are all off by default", () => {
    expect(Object.values(allFlags(parseEnv({})))).toEqual(Array(9).fill(false));
  });

  it("reads individual flags from the environment", () => {
    const env = parseEnv({ FEATURE_CLIENT_AI: "true" });
    expect(isEnabled("CLIENT_AI", env)).toBe(true);
    expect(isEnabled("XERO", env)).toBe(false);
  });
});
