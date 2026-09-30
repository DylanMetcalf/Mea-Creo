import { health } from "../types";
import type { CRMProvider, ExternalLead } from "./types";

export class MockCRMProvider implements CRMProvider {
  readonly kind = "crm" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly leads: ExternalLead[] = [];
  readonly statuses = new Map<string, string>();

  async healthCheck() {
    return health(this, "CONNECTED", "Mock lead source. Only leads added in tests appear.");
  }

  async fetchLeads(since: Date) {
    return this.leads.filter((lead) => lead.receivedAt >= since);
  }

  async reportStatus(externalId: string, status: string) {
    this.statuses.set(externalId, status);
  }
}
