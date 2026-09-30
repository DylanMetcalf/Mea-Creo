import type { DateRange, IntegrationAdapter } from "../types";

/** Search presence data via official APIs (Google Search Console first). Never scraped. */

export type SearchDimension = "query" | "page" | "country" | "device" | "date";

export interface SearchAnalyticsRequest {
  siteUrl: string;
  range: DateRange;
  dimensions: SearchDimension[];
  rowLimit?: number;
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SitemapInfo {
  path: string;
  lastSubmitted?: string;
  isPending: boolean;
  errors: number;
  warnings: number;
}

export interface UrlInspection {
  url: string;
  verdict: "PASS" | "NEUTRAL" | "FAIL" | "UNKNOWN";
  coverageState?: string;
  lastCrawlTime?: string;
}

export interface SearchProvider extends IntegrationAdapter {
  readonly kind: "search";
  listSites(): Promise<{ siteUrl: string; permissionLevel: string }[]>;
  querySearchAnalytics(request: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]>;
  listSitemaps(siteUrl: string): Promise<SitemapInfo[]>;
  inspectUrl(siteUrl: string, url: string): Promise<UrlInspection>;
}
