import { health } from "../types";
import type { EmailMessage, EmailProvider } from "./types";

/** Captures messages in memory. Use Mailpit via SMTP (docker compose) to see rendered email locally. */
export class MockEmailProvider implements EmailProvider {
  readonly kind = "email" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly outbox: (EmailMessage & { messageId: string })[] = [];

  async healthCheck() {
    return health(this, "CONNECTED", "Mock email. Messages are not delivered.");
  }

  async send(message: EmailMessage) {
    if (message.idempotencyKey) {
      const existing = this.outbox.find((m) => m.idempotencyKey === message.idempotencyKey);
      if (existing) return { messageId: existing.messageId };
    }
    const messageId = `mock-email-${this.outbox.length + 1}`;
    this.outbox.push({ ...message, messageId });
    return { messageId };
  }
}
