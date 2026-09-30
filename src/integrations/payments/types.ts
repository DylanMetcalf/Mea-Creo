import type { Money } from "@/lib/money";
import type { IntegrationAdapter } from "../types";

/**
 * Payment providers use hosted/tokenised checkout. The application never sees,
 * stores or logs card numbers or CVVs.
 */

export interface PaymentCustomer {
  email: string;
  name: string;
}

export interface CheckoutUrls {
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

/** Many SA gateways (e.g. Payfast) start checkout with an auto-submitted form POST. */
export interface CheckoutRedirect {
  url: string;
  method: "GET" | "POST";
  fields: Record<string, string>;
}

export interface OnceOffPaymentRequest extends CheckoutUrls {
  /** Our internal reference, echoed back in webhooks. */
  reference: string;
  amount: Money;
  description: string;
  customer: PaymentCustomer;
}

export type BillingFrequency = "monthly" | "quarterly" | "biannual" | "annual";

export interface SubscriptionRequest extends OnceOffPaymentRequest {
  frequency: BillingFrequency;
  /** First billing date, ISO date. */
  billingDate: string;
  /** Number of cycles, or 0 for indefinite. */
  cycles: number;
}

export type PaymentEventType =
  | "payment.completed"
  | "payment.failed"
  | "payment.cancelled"
  | "subscription.created"
  | "subscription.cancelled";

export interface PaymentWebhookEvent {
  type: PaymentEventType;
  reference: string;
  providerPaymentId: string;
  /** Provider token for recurring billing, if any. Store only the token. */
  subscriptionToken?: string;
  amount: Money;
  occurredAt: Date;
  raw: Record<string, string>;
}

export interface IncomingWebhook {
  rawBody: string;
  headers: Record<string, string | undefined>;
  sourceIp?: string;
}

export type WebhookVerification =
  { valid: true; event: PaymentWebhookEvent } | { valid: false; reason: string };

export interface PaymentProvider extends IntegrationAdapter {
  readonly kind: "payments";
  createOnceOffPayment(request: OnceOffPaymentRequest): Promise<CheckoutRedirect>;
  createSubscription(request: SubscriptionRequest): Promise<CheckoutRedirect>;
  verifyWebhook(webhook: IncomingWebhook): Promise<WebhookVerification>;
  pauseSubscription(token: string, cycles: number): Promise<void>;
  resumeSubscription(token: string): Promise<void>;
  cancelSubscription(token: string): Promise<void>;
}
