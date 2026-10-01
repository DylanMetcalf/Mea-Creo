import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createApiKey, revokeApiKey, verifyApiKey } from "@/modules/api-keys/service";
import { users } from "@/db/schema";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
let userId: string;

beforeAll(async () => {
  ({ db, close } = await testDb());
  [{ id: userId }] = await db
    .insert(users)
    .values({ email: "k@example.com", name: "Key Maker" })
    .returning({ id: users.id });
}, 60_000);
afterAll(() => close());

describe("API keys", () => {
  it("verifies a key only for its scopes, and stores only a hash", async () => {
    const { key } = await createApiKey(db, {
      name: "Founder OS",
      scopes: ["read:business"],
      createdById: userId,
    });
    expect(key).toMatch(/^mc_/);
    expect(await verifyApiKey(db, key, "read:business")).not.toBeNull();
    expect(await verifyApiKey(db, key, "write:leads")).toBeNull();
    const rows = await db.query.apiKeys.findMany();
    expect(JSON.stringify(rows)).not.toContain(key.split("_").at(-1)!);
  });

  it("rejects garbage, wrong and revoked keys", async () => {
    const { id, key } = await createApiKey(db, {
      name: "Temp",
      scopes: ["read:tasks"],
      createdById: userId,
    });
    expect(await verifyApiKey(db, "nope", "read:tasks")).toBeNull();
    expect(await verifyApiKey(db, key.slice(0, -2) + "xx", "read:tasks")).toBeNull();
    await revokeApiKey(db, id);
    expect(await verifyApiKey(db, key, "read:tasks")).toBeNull();
  });
});
