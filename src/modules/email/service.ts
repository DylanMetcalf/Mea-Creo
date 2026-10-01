import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { emailLog } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { logger } from "@/lib/logger";
import { getPlatformSetting } from "@/modules/settings/service";
import type { RenderedEmail } from "./templates";

/**
 * - transactional: account, security and billing messages (always sent)
 * - notification: workflow notifications to clients/staff (respects the email pause)
 * - outbound: prospecting/marketing (respects the pause; requires approval upstream)
 */
export type EmailCategory = "transactional" | "notification" | "outbound";

export interface SendEmailInput {
  to: { email: string; name?: string };
  template: string;
  email: RenderedEmail;
  category: EmailCategory;
  organisationId?: string | null;
  idempotencyKey?: string;
  /** One-click opt-out link (List-Unsubscribe). Required for outbound prospecting email. */
  unsubscribeUrl?: string;
  replyTo?: string;
}

/** Sends through the configured provider and records every message in the email log. */
export async function sendEmail(
  db: DbOrTx,
  input: SendEmailInput,
): Promise<{ status: "sent" | "failed" | "suppressed" }> {
  if (input.idempotencyKey) {
    const [existing] = await db
      .select({ status: emailLog.status })
      .from(emailLog)
      .where(eq(emailLog.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) return { status: existing.status };
  }

  const record = {
    organisationId: input.organisationId ?? null,
    template: input.template,
    to: input.to.email,
    subject: input.email.subject,
    text: input.email.text,
    html: input.email.html,
    idempotencyKey: input.idempotencyKey,
  };

  if (input.category !== "transactional") {
    const emergency = await getPlatformSetting(db, "emergency");
    if (emergency.pauseOutboundEmail) {
      await db.insert(emailLog).values({
        ...record,
        provider: "none",
        status: "suppressed",
        error: "Outbound email is paused (emergency control).",
      });
      return { status: "suppressed" };
    }
  }

  const resolution = resolveIntegration("email");
  if (!resolution.available) {
    await db.insert(emailLog).values({
      ...record,
      provider: resolution.health.provider,
      status: "failed",
      error: resolution.health.message,
    });
    return { status: "failed" };
  }

  try {
    const { messageId } = await resolution.adapter.send({
      to: [input.to],
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
      idempotencyKey: input.idempotencyKey,
      unsubscribeUrl: input.unsubscribeUrl,
      replyTo: input.replyTo,
      tags: { template: input.template },
    });
    await db.insert(emailLog).values({
      ...record,
      provider: resolution.adapter.provider,
      status: "sent",
      providerMessageId: messageId,
    });
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ template: input.template, err: message }, "email send failed");
    await db.insert(emailLog).values({
      ...record,
      provider: resolution.adapter.provider,
      status: "failed",
      error: message.slice(0, 1000),
    });
    return { status: "failed" };
  }
}
