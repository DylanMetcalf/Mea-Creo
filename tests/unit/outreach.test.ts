import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { approvals, communications, emailLog, leads, suppressions } from "@/db/schema";
import { executeApprovalAction } from "@/modules/approvals/service";
import { classifyResponse } from "@/modules/outreach/classify";
import { checkOutreachQuality } from "@/modules/outreach/compose";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/modules/outreach/identifiers";
import {
  checkOutreach,
  draftOutreach,
  logResponse,
  sendApprovedCommunication,
  suppressLead,
} from "@/modules/outreach/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

/** What approving does: run the approval's action (the decision UI is tested elsewhere). */
async function approve(approvalId: string) {
  const [a] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
  await executeApprovalAction(db, a.organisationId, a.action!, { type: "system", label: "Test" });
}

async function newLead(values: Partial<typeof leads.$inferInsert> = {}) {
  const [lead] = await db
    .insert(leads)
    .values({
      company: "Volt Electrical",
      industry: "Electrical",
      contactName: "Sipho Dlamini",
      contactRole: "Director",
      email: `sipho+${Math.random().toString(36).slice(2, 8)}@volt.example`,
      ...values,
    })
    .returning();
  return lead;
}

describe("Reply classification", () => {
  it.each([
    ["No thanks", "opt_out"],
    ["Please remove me from your list", "opt_out"],
    ["Thanks, but we're not interested at this stage.", "not_interested"],
    ["I am out of the office until Monday.", "out_of_office"],
    ["Can you send me a quote?", "wants_proposal"],
    ["Happy to have a quick call next Tuesday", "wants_call"],
    ["How much does this usually cost?", "needs_information"],
    ["Yes please send them", "interested"],
    ["I'm not the right person, speak to our marketing manager", "wrong_person"],
    ["We can rank your website with guest post backlinks", "spam"],
    ["ok", "unclear"],
  ])("%s → %s", (text, expected) => {
    expect(classifyResponse(text).class).toBe(expected);
  });
});

describe("Outreach QC", () => {
  it("blocks impersonal and generic agency messages", () => {
    const r = checkOutreachQuality("Dear Sir/Madam, we are a leading digital agency.");
    expect(r.passed).toBe(false);
    expect(r.issues.map((i) => i.rule)).toEqual(
      expect.arrayContaining(["Impersonal greeting", "Generic agency claim"]),
    );
  });
  it("requires an opt-out line on a first message", () => {
    expect(checkOutreachQuality("Hi Sipho, quick question.", { firstContact: true }).passed).toBe(
      false,
    );
  });
});

describe("Unsubscribe tokens", () => {
  it("verify only for the lead they were made for", () => {
    const id = "6f1c0e1e-6c55-4b8a-9d55-0d6f2f1a2b3c";
    expect(verifyUnsubscribeToken(unsubscribeToken(id))).toBe(id);
    expect(verifyUnsubscribeToken(`${id}.deadbeef`)).toBeNull();
    expect(verifyUnsubscribeToken("nonsense")).toBeNull();
  });
});

describe("Outreach compliance (POPIA s69)", () => {
  it("allows one permission request without consent, then nothing until they reply", async () => {
    const lead = await newLead();
    const first = await checkOutreach(db, lead, "email");
    expect(first.blocked).toBe(false);
    expect(first.consentRequestOnly).toBe(true);

    const { communicationId, approvalId } = await draftOutreach(db, lead.id, {
      channel: "email",
      purpose: "follow_up",
    });
    const [comm] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));
    // Forced to a permission request, with an opt-out line.
    expect(comm.purpose).toBe("consent_request");
    expect(comm.status).toBe("pending_approval");
    expect(comm.body).toMatch(/no thanks/);
    expect(comm.body).not.toMatch(/dear sir/i);
    // Never sent without a decision.
    expect(await db.select().from(emailLog).where(eq(emailLog.to, lead.email!))).toHaveLength(0);

    // A second draft is refused while the first is pending.
    await expect(draftOutreach(db, lead.id, { channel: "email" })).rejects.toThrow();

    await approve(approvalId!);
    const [sent] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));
    expect(sent.status).toBe("sent");
    const [log] = await db.select().from(emailLog).where(eq(emailLog.to, lead.email!));
    expect(log.text).toContain("/unsubscribe/");

    const after = await checkOutreach(db, { ...lead, stage: "contacted" }, "email");
    expect(after.blocked).toBe(true);
    expect(after.reasons.join(" ")).toMatch(/only one approach/);
  });

  it("a positive reply records consent and drafts the next step for approval", async () => {
    const lead = await newLead();
    const r = await logResponse(db, lead.id, { channel: "email", body: "Yes please, send them" });
    expect(r.classification).toBe("interested");
    const [updated] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(updated.consentStatus).toBe("given");
    const drafts = await db
      .select()
      .from(communications)
      .where(and(eq(communications.leadId, lead.id), eq(communications.direction, "outbound")));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].purpose).toBe("follow_up");
    expect(drafts[0].status).toBe("pending_approval");
  });

  it("an opt-out suppresses every channel, cancels pending messages and wins at send time", async () => {
    const lead = await newLead({
      phone: "082 555 0101",
      linkedinUrl: "https://www.linkedin.com/in/sipho-d/",
    });
    const { communicationId, approvalId } = await draftOutreach(db, lead.id, { channel: "email" });
    await logResponse(db, lead.id, { channel: "linkedin", body: "Please don't contact me again" });

    const rows = await db.select().from(suppressions).where(eq(suppressions.leadId, lead.id));
    expect(rows.map((r) => r.kind).sort()).toEqual(["email", "linkedin", "phone"]);
    const [comm] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));
    expect(comm.status).toBe("cancelled");
    const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId!));
    expect(approval.status).toBe("rejected");

    // Even if something tries to send it, the gate refuses.
    expect((await sendApprovedCommunication(db, communicationId)).status).toBe("blocked");

    // The same person on a different lead record is also blocked.
    const dup = await newLead({ phone: "+27 82 555 0101", email: null });
    const check = await checkOutreach(db, dup, "phone");
    expect(check.blocked).toBe(true);
    expect(check.reasons.join(" ")).toMatch(/do-not-contact/);
  });

  it("manual channels are approved for a person to send, never automated", async () => {
    const lead = await newLead({
      consentStatus: "given",
      linkedinUrl: "https://linkedin.com/in/x-y",
    });
    const { communicationId, approvalId } = await draftOutreach(db, lead.id, {
      channel: "linkedin",
      purpose: "follow_up",
    });
    await approve(approvalId!);
    const [comm] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));
    expect(comm.status).toBe("approved");
    expect(comm.sentAt).toBeNull();
  });

  it("manual suppression blocks drafting", async () => {
    const lead = await newLead();
    await suppressLead(db, lead.id, "manual", "test");
    await expect(draftOutreach(db, lead.id, { channel: "email" })).rejects.toMatchObject({
      userMessage: expect.stringMatching(/do-not-contact/),
    });
  });
});

describe("Inbound enquiries", () => {
  it("someone who contacted us can be replied to without a permission request", async () => {
    const lead = await newLead({ source: "contact_form" });
    const check = await checkOutreach(db, lead, "email");
    expect(check.blocked).toBe(false);
    expect(check.consentRequestOnly).toBe(false);
  });
});
