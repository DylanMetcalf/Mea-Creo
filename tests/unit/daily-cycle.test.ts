import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { domainEvents } from "@/db/schema";
import { runDailyCycle } from "@/modules/scheduler/daily";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

describe("Daily cycle", () => {
  it("starts the monthly client cycle once on the configured day", async () => {
    const firstOfMonth = new Date("2026-11-01T08:00:00+02:00");
    expect((await runDailyCycle(db, firstOfMonth)).monthlyCycle).toBe(true);
    expect((await runDailyCycle(db, firstOfMonth)).monthlyCycle).toBe(false);
    expect((await runDailyCycle(db, new Date("2026-11-02T08:00:00+02:00"))).monthlyCycle).toBe(
      false,
    );
    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.type, "monthly_cycle.started"));
    expect(events).toHaveLength(1);
  });
});
