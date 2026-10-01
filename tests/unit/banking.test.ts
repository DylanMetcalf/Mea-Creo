import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { settings, users } from "@/db/schema";
import {
  eftLines,
  getBankDetails,
  maskAccountNumber,
  setBankDetails,
} from "@/modules/banking/service";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
let userId: string;
beforeAll(async () => {
  ({ db, close } = await testDb());
  [{ id: userId }] = await db
    .insert(users)
    .values({ email: "f@example.com", name: "Founder" })
    .returning({ id: users.id });
}, 60_000);
afterAll(() => close());

describe("Banking details", () => {
  const details = {
    bank: "Test Bank",
    accountHolder: "Example (Pty) Ltd",
    accountType: "Business",
    branchCode: "123456",
    accountNumber: "62000000001",
  };

  it("stores only ciphertext and reads it back", async () => {
    expect(await getBankDetails(db)).toBeNull();
    await setBankDetails(db, details, userId);
    const raw = JSON.stringify(await db.select().from(settings));
    expect(raw).not.toContain(details.accountNumber);
    expect(raw).not.toContain(details.branchCode);
    expect(await getBankDetails(db)).toEqual(details);
  });

  it("masks the account number and builds invoice lines", () => {
    expect(maskAccountNumber(details.accountNumber)).toBe("•••• 0001");
    expect(eftLines(details, "MC-2026-0001").at(-1)).toBe("Reference: MC-2026-0001");
  });
});
