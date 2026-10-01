import { describe, expect, it } from "vitest";
import { money } from "@/lib/money";
import { MockAccountingProvider } from "./accounting/mock";
import { MockAIProvider } from "./ai/mock";
import { MockCalendarProvider } from "./calendar/mock";
import { MockEmailProvider } from "./email/mock";
import { MOCK_SIGNATURE_HEADER, MockPaymentProvider, signMockWebhook } from "./payments/mock";
import { MockSocialProvider } from "./social/mock";
import { MockStorageProvider } from "./storage/mock";

describe("MockPaymentProvider", () => {
  const body = new URLSearchParams({
    type: "payment.completed",
    reference: "INV-1",
    amount_minor: "500000",
    currency: "ZAR",
    subscription_token: "sub-1",
  }).toString();

  it("accepts correctly signed webhooks", async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.verifyWebhook({
      rawBody: body,
      headers: { [MOCK_SIGNATURE_HEADER]: signMockWebhook(body) },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.event.amount).toEqual(money(500_000, "ZAR"));
      expect(result.event.subscriptionToken).toBe("sub-1");
    }
  });

  it("rejects tampered or unsigned webhooks", async () => {
    const provider = new MockPaymentProvider();
    const tampered = body.replace("500000", "1");
    const signed = await provider.verifyWebhook({
      rawBody: tampered,
      headers: { [MOCK_SIGNATURE_HEADER]: signMockWebhook(body) },
    });
    expect(signed).toEqual({ valid: false, reason: "Signature mismatch" });
    expect((await provider.verifyWebhook({ rawBody: body, headers: {} })).valid).toBe(false);
  });

  it("builds a hosted checkout redirect without card data", async () => {
    const redirect = await new MockPaymentProvider().createOnceOffPayment({
      reference: "INV-1",
      amount: money(100),
      description: "Setup fee",
      customer: { email: "client@example.test", name: "Test Client" },
      returnUrl: "http://x/return",
      cancelUrl: "http://x/cancel",
      notifyUrl: "http://x/notify",
    });
    expect(redirect.method).toBe("GET");
    expect(Object.keys(redirect.fields).join()).not.toMatch(/card|cvv/i);
  });

  it("pauses, resumes and cancels subscriptions", async () => {
    const provider = new MockPaymentProvider();
    provider.subscriptions.set("sub-1", { status: "active" });
    await provider.pauseSubscription("sub-1");
    expect(provider.subscriptions.get("sub-1")?.status).toBe("paused");
    await provider.resumeSubscription("sub-1");
    await provider.cancelSubscription("sub-1");
    expect(provider.subscriptions.get("sub-1")?.status).toBe("cancelled");
  });
});

describe("MockAccountingProvider", () => {
  it("tracks invoice payment state", async () => {
    const xero = new MockAccountingProvider();
    const { externalId } = await xero.upsertContact({ name: "Example Engineering (Pty) Ltd" });
    const invoice = await xero.createInvoice({
      contactExternalId: externalId,
      reference: "MC-1",
      issueDate: "2026-10-01",
      dueDate: "2026-10-08",
      lines: [{ description: "Monthly retainer", quantity: 1, unitAmount: money(1_000_000) }],
    });
    await xero.recordPayment({
      invoiceExternalId: invoice.externalId,
      amount: money(1_000_000),
      date: "2026-10-02",
      reference: "p",
    });
    expect((await xero.getInvoice(invoice.externalId))?.status).toBe("PAID");
  });
});

describe("MockCalendarProvider", () => {
  it("reports busy time only for overlapping confirmed events", async () => {
    const cal = new MockCalendarProvider();
    const event = await cal.createEvent({
      calendarId: "primary",
      title: "Strategy call",
      start: new Date("2026-10-01T09:00:00Z"),
      end: new Date("2026-10-01T09:30:00Z"),
      attendees: [],
    });
    const range = {
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-10-02T00:00:00Z"),
    };
    expect(await cal.getBusy("primary", range)).toHaveLength(1);
    await cal.cancelEvent("primary", event.externalId);
    expect(await cal.getBusy("primary", range)).toHaveLength(0);
  });
});

describe("MockEmailProvider", () => {
  it("does not send twice for the same idempotency key", async () => {
    const email = new MockEmailProvider();
    const message = {
      to: [{ email: "a@example.test" }],
      subject: "s",
      html: "h",
      text: "t",
      idempotencyKey: "k1",
    };
    const first = await email.send(message);
    const second = await email.send(message);
    expect(second.messageId).toBe(first.messageId);
    expect(email.outbox).toHaveLength(1);
  });
});

describe("MockStorageProvider", () => {
  it("rejects path traversal keys", async () => {
    const storage = new MockStorageProvider();
    await expect(
      storage.putObject("../etc/passwd", new Uint8Array(), "text/plain"),
    ).rejects.toThrow();
    await expect(storage.putObject("/abs", new Uint8Array(), "text/plain")).rejects.toThrow();
    const stored = await storage.putObject(
      "org_1/docs/a.txt",
      new TextEncoder().encode("hi"),
      "text/plain",
    );
    expect(stored.size).toBe(2);
  });
});

describe("MockAIProvider", () => {
  it("labels output as mock and reports usage", async () => {
    const ai = new MockAIProvider();
    const result = await ai.generate({
      messages: [{ role: "user", content: "Summarise" }],
      maxTokens: 100,
    });
    expect(result.text.startsWith("[MOCK AI RESPONSE]")).toBe(true);
    expect(result.usage.outputTokens).toBeLessThanOrEqual(100);
  });
});

describe("MockSocialProvider", () => {
  it("refuses actions outside granted capabilities", async () => {
    const social = new MockSocialProvider(["page.read"]);
    await expect(social.publishPost({ pageId: "p", text: "hello" })).rejects.toThrow(
      /not a granted capability/,
    );
  });
});
