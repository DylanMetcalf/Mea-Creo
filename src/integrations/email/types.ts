import type { IntegrationAdapter } from "../types";

export interface EmailMessage {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Tags for provider-side analytics, e.g. template name. */
  tags?: Record<string, string>;
  /** Prevents duplicate sends when a job is retried. */
  idempotencyKey?: string;
  /** Required on marketing/outbound messages. */
  unsubscribeUrl?: string;
}

export interface EmailProvider extends IntegrationAdapter {
  readonly kind: "email";
  send(message: EmailMessage): Promise<{ messageId: string }>;
}
