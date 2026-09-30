import type { IntegrationAdapter } from "../types";

/**
 * Social platforms (LinkedIn first). Each provider must declare exactly what its
 * approved API access permits. Anything not declared is handled as an assisted,
 * human-performed workflow — never automated around platform terms.
 */

export type SocialCapability =
  "page.read" | "page.analytics" | "page.publish" | "ads.read" | "ads.manage" | "leads.sync";

export interface SocialPost {
  pageId: string;
  text: string;
  link?: string;
}

export interface SocialProvider extends IntegrationAdapter {
  readonly kind: "social";
  capabilities(): Promise<SocialCapability[]>;
  listPages(): Promise<{ id: string; name: string }[]>;
  getPageAnalytics(
    pageId: string,
    range: { start: string; end: string },
  ): Promise<Record<string, number>>;
  /** Only callable after an approval has been granted (enforced by the approval engine). */
  publishPost(post: SocialPost): Promise<{ externalId: string; url?: string }>;
}
