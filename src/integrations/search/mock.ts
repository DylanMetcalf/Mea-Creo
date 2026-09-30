import { health } from "../types";
import type { SearchProvider } from "./types";

/** Returns empty results: mock mode never fabricates search performance. */
export class MockSearchProvider implements SearchProvider {
  readonly kind = "search" as const;
  readonly provider = "mock";
  readonly isMock = true;

  async healthCheck() {
    return health(this, "CONNECTED", "Mock Search Console. Results are empty.");
  }

  async listSites() {
    return [{ siteUrl: "sc-domain:example.test", permissionLevel: "siteOwner" }];
  }

  async querySearchAnalytics() {
    return [];
  }

  async listSitemaps() {
    return [];
  }

  async inspectUrl(_siteUrl: string, url: string) {
    return { url, verdict: "UNKNOWN" as const };
  }
}
