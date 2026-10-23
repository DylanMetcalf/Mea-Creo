import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import {
  listSubscribers,
  subscribe,
  subscribeSchema,
  subscribersCsv,
  unsubscribe,
} from "@/modules/newsletter/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

describe("newsletter", () => {
  it("requires explicit consent", () => {
    expect(subscribeSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ email: "a@b.co", consent: "on" }).success).toBe(true);
  });

  it("records consent, unsubscribes by token, and re-subscribes only with new consent", async () => {
    const input = subscribeSchema.parse({
      email: "Thandi@Example.com",
      consent: "on",
      topics: ["linkedin"],
      source: "blog",
    });
    await subscribe(db, input);
    const [row] = await db.select().from(newsletterSubscribers);
    expect(row.email).toBe("thandi@example.com");
    expect(row.consentText).toMatch(/unsubscribe at any time/);
    expect(row.unsubscribeToken.length).toBeGreaterThanOrEqual(20);

    expect(await unsubscribe(db, "not-a-real-token-123456789")).toBe(false);
    expect(await unsubscribe(db, row.unsubscribeToken)).toBe(true);
    const after = await listSubscribers(db);
    expect(after[0].status).toBe("unsubscribed");
    // Unsubscribed addresses never appear in the export.
    expect(subscribersCsv(after).split("\n")).toHaveLength(1);

    await subscribe(db, input);
    const again = await listSubscribers(db);
    expect(again).toHaveLength(1);
    expect(again[0].status).toBe("subscribed");
    expect(subscribersCsv(again)).toContain("thandi@example.com");
  });
});
