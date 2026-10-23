import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { agentRuns } from "@/db/schema";
import { runBlogAssistant, splitDraft } from "@/modules/content/blog-assistant";
import { testDb } from "../helpers/db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  process.env.AI_PROVIDER = "none";
  ({ db, close } = await testDb());
}, 60_000);
afterAll(() => close());

describe("blog assistant without AI", () => {
  it("offers only an outline template, clearly labelled, and records the agent run", async () => {
    const r = await runBlogAssistant(db, {
      mode: "outline",
      topic: "GEO for engineering firms",
      audience: "engineering firm owners",
    });
    expect(r.source).toBe("rules");
    expect(r.title).toBe("GEO for engineering firms");
    expect(r.body).toContain("Outline template: AI isn't connected");
    expect(r.body).not.toMatch(/\d+%/);
    const runs = await db.select().from(agentRuns);
    expect(runs.at(-1)).toMatchObject({ agent: "content", status: "succeeded", costMicroUsd: 0 });
  });

  it("refuses to pretend to draft", async () => {
    await expect(
      runBlogAssistant(db, { mode: "draft", topic: "LinkedIn for B2B" }),
    ).rejects.toThrow("AI_UNAVAILABLE");
  });

  it("splits a generated title and summary off the body", () => {
    expect(splitDraft("# A title\nSummary: One line.\n\n## Part\nText")).toEqual({
      title: "A title",
      summary: "One line.",
      body: "## Part\nText",
    });
  });
});
