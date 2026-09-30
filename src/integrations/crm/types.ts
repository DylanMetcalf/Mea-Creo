import type { IntegrationAdapter } from "../types";

/**
 * External lead sources and CRMs (Sales Scout first). The Mea Creo CRM itself is
 * native; this contract only covers importing leads and reporting status back.
 */

export interface ExternalLead {
  externalId: string;
  source: string;
  company: string;
  website?: string;
  industry?: string;
  location?: string;
  contact?: { name?: string; email?: string; role?: string };
  score?: number;
  notes?: string;
  receivedAt: Date;
}

export interface CRMProvider extends IntegrationAdapter {
  readonly kind: "crm";
  fetchLeads(since: Date): Promise<ExternalLead[]>;
  reportStatus(externalId: string, status: string): Promise<void>;
}
