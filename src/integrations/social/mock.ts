import { health } from "../types";
import type { SocialCapability, SocialPost, SocialProvider } from "./types";

export class MockSocialProvider implements SocialProvider {
  readonly kind = "social" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly published: SocialPost[] = [];

  constructor(private readonly granted: SocialCapability[] = ["page.read", "page.analytics"]) {}

  async healthCheck() {
    return health(this, "CONNECTED", "Mock social. Nothing is posted.");
  }

  async capabilities() {
    return this.granted;
  }

  async listPages() {
    return [{ id: "mock-page", name: "Mock company page" }];
  }

  async getPageAnalytics() {
    return {};
  }

  async publishPost(post: SocialPost) {
    if (!this.granted.includes("page.publish")) {
      throw new Error("page.publish is not a granted capability for this provider");
    }
    this.published.push(post);
    return { externalId: `mock-post-${this.published.length}` };
  }
}
