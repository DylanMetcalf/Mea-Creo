import type { DateRange, IntegrationAdapter } from "../types";

/**
 * Website analytics (Google Analytics 4 first). Kept deliberately separate from
 * search data: analytics measures on-site behaviour, search measures presence in results.
 */

export interface AnalyticsReportRequest {
  propertyId: string;
  range: DateRange;
  metrics: string[];
  dimensions?: string[];
  limit?: number;
}

export interface AnalyticsReport {
  dimensionHeaders: string[];
  metricHeaders: string[];
  rows: { dimensions: string[]; metrics: number[] }[];
}

export interface AnalyticsProvider extends IntegrationAdapter {
  readonly kind: "analytics";
  listProperties(): Promise<{ id: string; name: string }[]>;
  runReport(request: AnalyticsReportRequest): Promise<AnalyticsReport>;
}
