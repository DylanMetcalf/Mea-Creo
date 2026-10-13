import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/modules/auth/password";
import { createFirstFounder, setupSchema, setupStatus } from "@/modules/auth/setup";
import { testDb } from "../helpers/db";

const TOKEN = "a-long-setup-code-2026";
const input = (over: Record<string, string> = {}) =>
  setupSchema.parse({
    code: TOKEN,
    name: "Dylan Metcalf",
    email: "Dylan@MeaCreo.co.za",
    password: "correct horse battery",
    confirm: "correct horse battery",
    ...over,
  });

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await testDb());
}, 60_000);
afterAll(() => close());

describe("first-time setup", () => {
  it("stays closed until a long enough setup code is configured", async () => {
    expect(await setupStatus(db, undefined)).toBe("not_configured");
    expect(await setupStatus(db, "short")).toBe("not_configured");
    expect(await setupStatus(db, TOKEN)).toBe("open");
  });

  it("rejects a wrong code and mismatched passwords", async () => {
    await expect(
      createFirstFounder(db, input({ code: "wrong-code-wrong-code" }), TOKEN),
    ).rejects.toThrow();
    expect(setupSchema.safeParse({ ...input(), confirm: "something else entirely" }).success).toBe(
      false,
    );
  });

  it("creates the founder once, with a hashed password, then closes", async () => {
    const { userId } = await createFirstFounder(db, input(), TOKEN);
    const [user] = await db.select().from(users);
    expect(user.id).toBe(userId);
    expect(user.email).toBe("dylan@meacreo.co.za");
    expect(user.passwordHash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", user.passwordHash!)).toBe(true);
    expect(await setupStatus(db, TOKEN)).toBe("done");
    await expect(
      createFirstFounder(db, input({ email: "someone@else.test" }), TOKEN),
    ).rejects.toMatchObject({ userMessage: "Setup has already been completed." });
  });
});
