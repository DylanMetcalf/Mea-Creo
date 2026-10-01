import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { leads } from "@/db/schema";
import { hmacSha256 } from "@/lib/crypto";
import {
  importSalesScoutLeads,
  salesScoutPayload,
  verifySalesScoutSignature,
} from "@/modules/integrations/sales-scout";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb()), 60_000);
afterAll(() => close());

describe("Sales Scout", () => {
  it("accepts only correctly signed bodies", () => {
    const body = JSON.stringify({ leads: [] });
    const sig = hmacSha256("secret", body);
    expect(verifySalesScoutSignature("secret", body, sig)).toBe(true);
    expect(verifySalesScoutSignature("secret", body, `sha256=${sig}`)).toBe(true);
    expect(verifySalesScoutSignature("other", body, sig)).toBe(false);
    expect(verifySalesScoutSignature("secret", body + " ", sig)).toBe(false);
    expect(verifySalesScoutSignature("secret", body, null)).toBe(false);
  });

  it("imports idempotently by external id, without recording consent", async () => {
    const payload = salesScoutPayload.parse({
      leads: [
        {
          externalId: "ss-1",
          company: "Pump Co",
          industry: "Engineering",
          contact: { name: "A", email: "A@Pump.example" },
        },
      ],
    });
    expect(await importSalesScoutLeads(db, payload)).toEqual({ created: 1, updated: 0 });
    expect(await importSalesScoutLeads(db, payload)).toEqual({ created: 0, updated: 1 });
    const rows = await db.select().from(leads).where(eq(leads.externalId, "ss-1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@pump.example");
    expect(rows[0].consentAt).toBeNull();
    expect(rows[0].score).not.toBeNull();
  });
});
