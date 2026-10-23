import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { domainEvents, emailLog, leads, memberships, users } from "@/db/schema";
import { emitEvent } from "@/modules/notifications/service";
import { processDomainEvents, WORKFLOW_RULES } from "@/modules/workflows/engine";
import { testDb } from "../helpers/db";

let db: Db;
let platformId: string;
let close: () => Promise<void>;
beforeAll(async () => ({ db, platformId, close } = await testDb()), 60_000);
afterAll(() => close());

describe("new enquiry emails", () => {
  it("emails the founder and confirms to the enquirer, once each", async () => {
    const [founder] = await db
      .insert(users)
      .values({ email: "dylan@example.test", name: "Dylan" })
      .returning();
    await db
      .insert(memberships)
      .values({ userId: founder.id, organisationId: platformId, role: "founder" });
    const [lead] = await db
      .insert(leads)
      .values({
        company: "Rockwell Drilling",
        contactName: "Thandi",
        email: "thandi@rockwell.example",
        source: "contact_form",
        message: "We need help being found on Google.",
      })
      .returning();
    await emitEvent(db, "lead.created", null, { leadId: lead.id, source: "contact_form" });
    await processDomainEvents(db);

    const sent = await db.select().from(emailLog);
    expect(sent.map((e) => [e.to, e.template]).sort()).toEqual([
      ["dylan@example.test", "staffNotification"],
      ["thandi@rockwell.example", "enquiryReceived"],
    ]);
    expect(sent.find((e) => e.to === "dylan@example.test")!.subject).toBe(
      "Enquiry: Rockwell Drilling",
    );

    // Re-running the same rule (a retry) sends nothing new.
    const [event] = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.type, "lead.created"));
    await WORKFLOW_RULES.find((r) => r.id === "lead-email-alert")!.handler(db, event);
    expect(await db.select().from(emailLog)).toHaveLength(2);
  });
});
