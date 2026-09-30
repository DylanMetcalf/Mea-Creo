import { health } from "../types";
import type { AnalyticsProvider, AnalyticsReport, AnalyticsReportRequest } from "./types";

/** Returns empty reports: mock mode never fabricates performance numbers. */
export class MockAnalyticsProvider implements AnalyticsProvider {
  readonly kind = "analytics" as const;
  readonly provider = "mock";
  readonly isMock = true;

  async healthCheck() {
    return health(this, "CONNECTED", "Mock analytics. Reports are empty.");
  }

  async listProperties() {
    return [{ id: "mock-property", name: "Mock property" }];
  }

  async runReport(request: AnalyticsReportRequest): Promise<AnalyticsReport> {
    return {
      dimensionHeaders: request.dimensions ?? [],
      metricHeaders: request.metrics,
      rows: [],
    };
  }
}
