import { getEnv, type Env } from "./env";

/**
 * Feature flags let V1 ship with unfinished or unapproved capabilities switched off.
 *
 * Source of truth today is the environment. Phase 6 (admin settings) adds a
 * database override per organisation; `isEnabled` is the single entry point so
 * callers do not change when that lands.
 */
export const FEATURE_FLAGS = {
  XERO: "FEATURE_XERO",
  PAYFAST: "FEATURE_PAYFAST",
  GOOGLE_ANALYTICS: "FEATURE_GOOGLE_ANALYTICS",
  GSC: "FEATURE_GSC",
  AI_AUTOMATION: "FEATURE_AI_AUTOMATION",
  SALES_SCOUT: "FEATURE_SALES_SCOUT",
  CLIENT_AI: "FEATURE_CLIENT_AI",
  SELF_SERVICE: "FEATURE_SELF_SERVICE",
  LINKEDIN: "FEATURE_LINKEDIN",
} as const satisfies Record<string, keyof Env>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isEnabled(flag: FeatureFlag, env: Env = getEnv()): boolean {
  return env[FEATURE_FLAGS[flag]] === true;
}

export function allFlags(env: Env = getEnv()): Record<FeatureFlag, boolean> {
  return Object.fromEntries(
    (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map((flag) => [flag, isEnabled(flag, env)]),
  ) as Record<FeatureFlag, boolean>;
}
