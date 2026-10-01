import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { approvals, clients, clientServices, invoices, reports, services } from "@/db/schema";
import { money } from "@/lib/money";
import type { AuthContext } from "@/modules/auth/context";
import { permissionsFor } from "@/modules/auth/permissions";
import { askMeaCreo } from "@/modules/assistant/service";
import {
  canDecide,
  decideApproval,
  effectiveLevel,
  requestApproval,
} from "@/modules/approvals/service";
import { applyPaymentEvent, createInvoice, runDailyBilling } from "@/modules/billing/service";
import { createClientOrganisation } from "@/modules/onboarding/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
let orgA: string;
let orgB: string;

function clientCtx(organisationId: string): AuthContext {
  const permissions = new Set(permissionsFor("client_admin"));
  return {
    kind: "client",
    role: "client_admin",
    organisationId,
    organisationName: "X",
    organisations: [],
    user: { id: "00000000-0000-7000-8000-000000000001", name: "Client", email: "c@example.com" },
    permissions,
    can: (p: string) => permissions.has(p as never),
  } as unknown as AuthContext;
}

beforeAll(async () => {
  ({ db, close } = await testDb());
  orgA = await createClientOrganisation(db, { name: "Alpha Ltd" });
  orgB = await createClientOrganisation(db, { name: "Beta Ltd" });
}, 60_000);
afterAll(() => close());

describe("Billing lifecycle", () => {
  it("open → paid on a verified payment, idempotently", async () => {
    const inv = await createInvoice(db, {
      organisationId: orgA,
      kind: "setup",
      currency: "ZAR",
      lines: [{ description: "Setup", unitMinor: 500_000 }],
    });
    expect(inv.status).toBe("open");
    const event = {
      type: "payment.completed" as const,
      reference: inv.id,
      providerPaymentId: "p-1",
      amount: money(500_000, "ZAR"),
      occurredAt: new Date(),
      raw: {},
    };
    await applyPaymentEvent(db, "mock", event);
    await applyPaymentEvent(db, "mock", event); // duplicate notification
    const [after] = await db.select().from(invoices).where(eq(invoices.id, inv.id));
    expect(after.status).toBe("paid");
    expect(after.amountPaidMinor).toBe(500_000);
  });

  it("marks overdue, then pauses automated services after the grace period without deleting anything", async () => {
    const [svc] = await db.select().from(services).limit(1);
    await db
      .insert(clientServices)
      .values({
        organisationId: orgB,
        serviceId: svc.id,
        status: "active",
        currency: "ZAR",
        monthlyMinor: 100_000,
      });
    const inv = await createInvoice(db, {
      organisationId: orgB,
      kind: "monthly",
      currency: "ZAR",
      lines: [{ description: "Monthly", unitMinor: 100_000 }],
      dueInDays: 0,
    });
    const later = new Date(Date.now() + 30 * 86400_000);
    const result = await runDailyBilling(db, later);
    expect(result.overdue).toBeGreaterThanOrEqual(1);
    const [i] = await db.select().from(invoices).where(eq(invoices.id, inv.id));
    expect(i.status).toBe("overdue");
    const [c] = await db.select().from(clients).where(eq(clients.organisationId, orgB));
    expect(["overdue", "suspended"]).toContain(c.billingState);
    const lines = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.organisationId, orgB));
    expect(lines).toHaveLength(1);
    expect(lines[0].status).toBe("paused");
  });
});

describe("Approval engine", () => {
  it("never lets budget changes become automatic", async () => {
    expect(await effectiveLevel(db, "budget.change", "budget", "automatic")).not.toBe("automatic");
  });

  it("lets only the owning client decide client-level approvals", async () => {
    const { id } = await requestApproval(db, {
      organisationId: orgA,
      level: "client",
      type: "content",
      title: "Approve article",
    });
    const [a] = await db.select().from(approvals).where(eq(approvals.id, id));
    expect(canDecide(clientCtx(orgA), a)).toBe(true);
    expect(canDecide(clientCtx(orgB), a)).toBe(false);
    await expect(decideApproval(db, clientCtx(orgB), id, "approved")).rejects.toThrow();
    const [still] = await db.select().from(approvals).where(eq(approvals.id, id));
    expect(still.status).toBe("pending");
  });
});

describe("Ask Mea Creo isolation", () => {
  it("never answers with another organisation's data or unpublished reports", async () => {
    await db
      .insert(reports)
      .values({
        organisationId: orgB,
        title: "Beta secret plan",
        status: "published",
        content: {
          headline: "BETA-ONLY-HEADLINE",
          whatWeDid: [],
          whatChanged: [],
          whatWeLearned: [],
          opportunities: [],
          whatHappensNext: [],
          needsFromYou: [],
          activityMetrics: [],
          outcomeMetrics: [],
          dataNotes: [],
        },
      });
    await db
      .insert(reports)
      .values({
        organisationId: orgA,
        title: "Alpha draft",
        status: "draft",
        content: {
          headline: "ALPHA-DRAFT-HEADLINE",
          whatWeDid: [],
          whatChanged: [],
          whatWeLearned: [],
          opportunities: [],
          whatHappensNext: [],
          needsFromYou: [],
          activityMetrics: [],
          outcomeMetrics: [],
          dataNotes: [],
        },
      });
    for (const q of [
      "What does my latest report mean?",
      "What happened this month?",
      "What are you doing for us?",
    ]) {
      const a = await askMeaCreo(db, orgA, q);
      expect(a.answer).not.toContain("BETA-ONLY-HEADLINE");
      expect(a.answer).not.toContain("ALPHA-DRAFT-HEADLINE");
    }
  });
});
