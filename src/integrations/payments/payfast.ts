import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { fromMajor, isCurrency } from "@/lib/money";
import { health } from "../types";
import type {
  BillingFrequency,
  CheckoutRedirect,
  IncomingWebhook,
  OnceOffPaymentRequest,
  PaymentEventType,
  PaymentProvider,
  SubscriptionRequest,
  WebhookVerification,
} from "./types";

/**
 * Payfast (South Africa). REQUIRES CONFIGURATION: PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY,
 * PAYFAST_PASSPHRASE (and PAYFAST_SANDBOX=true for testing).
 *
 * Card details are entered on Payfast's hosted page and never reach this application.
 * ITN (payment notification) validation follows Payfast's four checks: signature,
 * source host, server-side confirmation, and amount (checked by the billing handler).
 */

const FREQUENCY: Record<BillingFrequency, string> = {
  monthly: "3",
  quarterly: "4",
  biannual: "5",
  annual: "6",
};
const VALID_HOSTS = [
  "www.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
  "sandbox.payfast.co.za",
];

/** Payfast's encoding: urlencode with spaces as "+" and uppercase percent-escapes. */
export function payfastEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** MD5 signature over fields in the given order (empty values skipped), plus passphrase. */
export function payfastSignature(fields: [string, string][], passphrase?: string): string {
  const pairs = fields
    .filter(([, v]) => v !== "" && v !== undefined)
    .map(([k, v]) => `${k}=${payfastEncode(v)}`);
  if (passphrase) pairs.push(`passphrase=${payfastEncode(passphrase)}`);
  return createHash("md5").update(pairs.join("&")).digest("hex");
}

export class PayfastPaymentProvider implements PaymentProvider {
  readonly kind = "payments" as const;
  readonly provider = "payfast";
  readonly isMock = false;

  constructor(
    private readonly config: {
      merchantId: string;
      merchantKey: string;
      passphrase: string;
      sandbox: boolean;
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get host() {
    return this.config.sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
  }

  async healthCheck() {
    const missing = !this.config.merchantId || !this.config.merchantKey || !this.config.passphrase;
    if (missing)
      return health(
        this,
        "ACTION_REQUIRED",
        "Payfast merchant ID, key and passphrase are required.",
      );
    return health(
      this,
      "CONNECTED",
      `Payfast configured (${this.config.sandbox ? "sandbox" : "live"}). Card data is handled on Payfast's hosted page.`,
    );
  }

  private buildFields(
    request: OnceOffPaymentRequest,
    extra: [string, string][] = [],
  ): [string, string][] {
    if (request.amount.currency !== "ZAR") throw new Error("Payfast only accepts ZAR.");
    const [first, ...rest] = request.customer.name.split(" ");
    return [
      ["merchant_id", this.config.merchantId],
      ["merchant_key", this.config.merchantKey],
      ["return_url", request.returnUrl],
      ["cancel_url", request.cancelUrl],
      ["notify_url", request.notifyUrl],
      ["name_first", first ?? ""],
      ["name_last", rest.join(" ")],
      ["email_address", request.customer.email],
      ["m_payment_id", request.reference],
      ["amount", (request.amount.amountMinor / 100).toFixed(2)],
      ["item_name", request.description.slice(0, 100)],
      ...extra,
    ];
  }

  private redirect(fields: [string, string][]): CheckoutRedirect {
    const signature = payfastSignature(fields, this.config.passphrase);
    return {
      url: `${this.host}/eng/process`,
      method: "POST",
      fields: Object.fromEntries([...fields.filter(([, v]) => v !== ""), ["signature", signature]]),
    };
  }

  async createOnceOffPayment(request: OnceOffPaymentRequest) {
    return this.redirect(this.buildFields(request));
  }

  async createSubscription(request: SubscriptionRequest) {
    return this.redirect(
      this.buildFields(request, [
        ["subscription_type", "1"],
        ["billing_date", request.billingDate],
        ["recurring_amount", (request.amount.amountMinor / 100).toFixed(2)],
        ["frequency", FREQUENCY[request.frequency]],
        ["cycles", String(request.cycles)],
      ]),
    );
  }

  private async sourceIsPayfast(ip?: string): Promise<boolean> {
    if (!ip) return false;
    const resolved = await Promise.all(
      VALID_HOSTS.map((h) => lookup(h, { all: true }).catch(() => [] as { address: string }[])),
    );
    return resolved.flat().some((r) => r.address === ip);
  }

  async verifyWebhook(webhook: IncomingWebhook): Promise<WebhookVerification> {
    const params = [...new URLSearchParams(webhook.rawBody).entries()];
    const received = params.find(([k]) => k === "signature")?.[1];
    const fields = params.filter(([k]) => k !== "signature");
    if (!received || payfastSignature(fields, this.config.passphrase) !== received)
      return { valid: false, reason: "Signature mismatch" };
    if (!(await this.sourceIsPayfast(webhook.sourceIp)))
      return { valid: false, reason: "Notification did not come from Payfast" };

    const paramString = fields.map(([k, v]) => `${k}=${payfastEncode(v)}`).join("&");
    const confirm = await this.fetchImpl(`${this.host}/eng/query/validate`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: paramString,
      signal: AbortSignal.timeout(15_000),
    });
    if ((await confirm.text()).trim() !== "VALID")
      return { valid: false, reason: "Payfast did not confirm the notification" };

    const data = Object.fromEntries(fields);
    const status = data.payment_status;
    const type: PaymentEventType =
      status === "COMPLETE"
        ? "payment.completed"
        : status === "CANCELLED"
          ? "subscription.cancelled"
          : "payment.failed";
    const currency = "ZAR";
    if (!isCurrency(currency)) return { valid: false, reason: "Unsupported currency" };
    return {
      valid: true,
      event: {
        type,
        reference: data.m_payment_id ?? "",
        providerPaymentId: data.pf_payment_id ?? "",
        subscriptionToken: data.token || undefined,
        amount: fromMajor(data.amount_gross ?? "0", "ZAR"),
        occurredAt: new Date(),
        raw: data,
      },
    };
  }

  /** Payfast subscription API. Signature over alphabetically sorted headers + passphrase. */
  private async subscriptionCall(
    token: string,
    action: "pause" | "unpause" | "cancel",
    body?: Record<string, string>,
  ) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
    const signed: Record<string, string> = {
      "merchant-id": this.config.merchantId,
      passphrase: this.config.passphrase,
      timestamp,
      version: "v1",
      ...(body ?? {}),
    };
    const signature = createHash("md5")
      .update(
        Object.keys(signed)
          .sort()
          .map((k) => `${k}=${payfastEncode(signed[k])}`)
          .join("&"),
      )
      .digest("hex");
    const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/${action}${this.config.sandbox ? "?testing=true" : ""}`;
    const response = await this.fetchImpl(url, {
      method: "PUT",
      headers: {
        "merchant-id": this.config.merchantId,
        version: "v1",
        timestamp,
        signature,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Payfast ${action} failed with HTTP ${response.status}`);
  }

  async pauseSubscription(token: string, cycles: number) {
    await this.subscriptionCall(token, "pause", { cycles: String(cycles) });
  }

  async resumeSubscription(token: string) {
    await this.subscriptionCall(token, "unpause");
  }

  async cancelSubscription(token: string) {
    await this.subscriptionCall(token, "cancel");
  }
}
