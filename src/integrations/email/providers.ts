import nodemailer from "nodemailer";
import { health } from "../types";
import type { EmailMessage, EmailProvider } from "./types";

/** Resend (https://resend.com) over its HTTPS API. REQUIRES CONFIGURATION: RESEND_API_KEY. */
export class ResendEmailProvider implements EmailProvider {
  readonly kind = "email" as const;
  readonly provider = "resend";
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async healthCheck() {
    return this.apiKey
      ? health(this, "CONNECTED", "Resend API key configured.")
      : health(this, "ACTION_REQUIRED", "Add RESEND_API_KEY to send email.");
  }

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to.map((t) => (t.name ? `${t.name} <${t.email}>` : t.email)),
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        headers: message.unsubscribeUrl
          ? { "List-Unsubscribe": `<${message.unsubscribeUrl}>` }
          : undefined,
        tags: message.tags
          ? Object.entries(message.tags).map(([name, value]) => ({
              name,
              value: value.replace(/[^a-zA-Z0-9_-]/g, "_"),
            }))
          : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(
        `Resend responded ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    const data = (await response.json()) as { id: string };
    return { messageId: data.id };
  }
}

/** Any SMTP server (Mailpit locally, or a provider's SMTP relay). REQUIRES CONFIGURATION: SMTP_URL. */
export class SmtpEmailProvider implements EmailProvider {
  readonly kind = "email" as const;
  readonly provider = "smtp";
  readonly isMock = false;
  private readonly transport;

  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(url);
  }

  async healthCheck() {
    try {
      await this.transport.verify();
      return health(this, "CONNECTED", "SMTP server reachable.");
    } catch (error) {
      return health(
        this,
        "ERROR",
        `SMTP server not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async send(message: EmailMessage) {
    const info = await this.transport.sendMail({
      from: this.from,
      to: message.to.map((t) => (t.name ? `"${t.name}" <${t.email}>` : t.email)),
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      headers: message.unsubscribeUrl
        ? { "List-Unsubscribe": `<${message.unsubscribeUrl}>` }
        : undefined,
    });
    return { messageId: info.messageId };
  }
}
