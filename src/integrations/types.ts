/**
 * Shared contracts for every external integration.
 *
 * Application code depends only on these interfaces, never on a vendor SDK.
 * Concrete adapters (real or mock) are resolved by `registry.ts`.
 */

export const INTEGRATION_KINDS = [
  "payments",
  "accounting",
  "calendar",
  "analytics",
  "search",
  "ai",
  "email",
  "storage",
  "crm",
  "social",
] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

/** Matches the admin "integration health" states in the product specification. */
export type IntegrationStatus = "CONNECTED" | "ACTION_REQUIRED" | "ERROR" | "NOT_CONNECTED";

export interface IntegrationHealth {
  kind: IntegrationKind;
  provider: string;
  status: IntegrationStatus;
  /** True when a development mock is serving this integration. */
  mock: boolean;
  /** Human-readable explanation, safe to show to an admin. */
  message: string;
  checkedAt: Date;
}

export interface IntegrationAdapter {
  readonly kind: IntegrationKind;
  /** Stable provider id, e.g. "payfast", "xero", "mock". */
  readonly provider: string;
  readonly isMock: boolean;
  healthCheck(): Promise<IntegrationHealth>;
}

export function health(
  adapter: Pick<IntegrationAdapter, "kind" | "provider" | "isMock">,
  status: IntegrationStatus,
  message: string,
): IntegrationHealth {
  return {
    kind: adapter.kind,
    provider: adapter.provider,
    status,
    mock: adapter.isMock,
    message,
    checkedAt: new Date(),
  };
}

export interface DateRange {
  /** Inclusive, ISO date (YYYY-MM-DD). */
  start: string;
  /** Inclusive, ISO date (YYYY-MM-DD). */
  end: string;
}
