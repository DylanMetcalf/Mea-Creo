import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isCurrency, money } from "@/lib/money";
import { health } from "../types";
import type {
  CheckoutRedirect,
  IncomingWebhook,
  OnceOffPaymentRequest,
  PaymentEventType,
  PaymentProvider,
  SubscriptionRequest,
  WebhookVerification,
} from "./types";

const MOCK_WEBHOOK_SECRET = "mock-payments-webhook-secret";
export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

/** Signs a mock webhook body the way the mock provider expects. Tests and dev tools only. */
export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export class MockPaymentProvider implements PaymentProvider {
  readonly kind = "payments" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly subscriptions = new Map<string, { status: "active" | "paused" | "cancelled" }>();

  constructor(private readonly checkoutBaseUrl = "http://localhost:3000/dev/mock-checkout") {}

  async healthCheck() {
    return health(this, "CONNECTED", "Mock payments. No real money moves.");
  }

  async createOnceOffPayment(request: OnceOffPaymentRequest): Promise<CheckoutRedirect> {
    return this.redirect(request, {});
  }

  async createSubscription(request: SubscriptionRequest): Promise<CheckoutRedirect> {
    return this.redirect(request, {
      frequency: request.frequency,
      billing_date: request.billingDate,
      cycles: String(request.cycles),
    });
  }

  async verifyWebhook(webhook: IncomingWebhook): Promise<WebhookVerification> {
    const signature = webhook.headers[MOCK_SIGNATURE_HEADER];
    if (!signature) return { valid: false, reason: "Missing signature" };
    const expected = Buffer.from(signMockWebhook(webhook.rawBody));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return { valid: false, reason: "Signature mismatch" };
    }

    const fields = Object.fromEntries(new URLSearchParams(webhook.rawBody));
    const currency = fields.currency ?? "ZAR";
    const amountMinor = Number(fields.amount_minor);
    if (!fields.reference || !Number.isSafeInteger(amountMinor) || !isCurrency(currency)) {
      return { valid: false, reason: "Malformed payload" };
    }
    const token = fields.subscription_token || undefined;
    if (token && !this.subscriptions.has(token))
      this.subscriptions.set(token, { status: "active" });

    return {
      valid: true,
      event: {
        type: (fields.type as PaymentEventType) ?? "payment.completed",
        reference: fields.reference,
        providerPaymentId: fields.payment_id ?? randomUUID(),
        subscriptionToken: token,
        amount: money(amountMinor, currency),
        occurredAt: new Date(),
        raw: fields,
      },
    };
  }

  async pauseSubscription(token: string): Promise<void> {
    this.requireSubscription(token).status = "paused";
  }

  async resumeSubscription(token: string): Promise<void> {
    this.requireSubscription(token).status = "active";
  }

  async cancelSubscription(token: string): Promise<void> {
    this.requireSubscription(token).status = "cancelled";
  }

  private requireSubscription(token: string) {
    const sub = this.subscriptions.get(token);
    if (!sub) throw new Error(`Unknown mock subscription ${token}`);
    return sub;
  }

  private redirect(
    request: OnceOffPaymentRequest,
    extra: Record<string, string>,
  ): CheckoutRedirect {
    return {
      url: this.checkoutBaseUrl,
      method: "POST",
      fields: {
        reference: request.reference,
        amount_minor: String(request.amount.amountMinor),
        currency: request.amount.currency,
        description: request.description,
        email: request.customer.email,
        return_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        notify_url: request.notifyUrl,
        ...extra,
      },
    };
  }
}
