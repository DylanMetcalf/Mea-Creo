"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from "@/integrations/payments/mock";
import { resolveIntegration } from "@/integrations/registry";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { handlePaymentWebhook } from "@/modules/billing/service";

/** Only same-site return URLs are followed. */
function safeReturn(url: string): string {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  try {
    const target = new URL(url, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}` : "/";
  } catch {
    return "/";
  }
}

/** Simulates the provider's notification + redirect. Exists only while payments are mocked. */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  const payments = resolveIntegration("payments");
  if (!payments.available || !payments.adapter.isMock) throw new AppError("FORBIDDEN");
  const outcome = String(formData.get("outcome"));
  const returnUrl = String(formData.get("return_url") ?? "/");
  const cancelUrl = String(formData.get("cancel_url") ?? "/");
  if (outcome === "cancel") redirect(safeReturn(cancelUrl));
  const body = new URLSearchParams({
    type: outcome === "success" ? "payment.completed" : "payment.failed",
    reference: String(formData.get("reference")),
    amount_minor: String(formData.get("amount_minor")),
    currency: String(formData.get("currency") ?? "ZAR"),
    payment_id: `mock_${randomToken(10)}`,
    ...(formData.get("frequency") ? { subscription_token: `mocksub_${randomToken(10)}` } : {}),
  }).toString();
  await handlePaymentWebhook(await getDb(), payments.adapter.provider, {
    rawBody: body,
    headers: { [MOCK_SIGNATURE_HEADER]: signMockWebhook(body) },
  });
  redirect(
    safeReturn(
      outcome === "success" ? returnUrl : cancelUrl.replace("payment=cancelled", "payment=failed"),
    ),
  );
}
