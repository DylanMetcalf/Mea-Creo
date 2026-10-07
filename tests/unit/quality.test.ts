import { describe, expect, it } from "vitest";
import { nextStage } from "@/modules/quality/service";

const check = (done: boolean) => ({ key: "k", label: "Check", done });

describe("QA stage gate", () => {
  it("moves forward one stage at a time", () => {
    expect(nextStage({ stage: "draft", checklist: [] }).next).toBe("internal_review");
    expect(nextStage({ stage: "approved", checklist: [] }).next).toBe("published");
    expect(nextStage({ stage: "published", checklist: [] }).next).toBeNull();
  });

  it("blocks QA until every check is ticked", () => {
    expect(nextStage({ stage: "qa", checklist: [check(true), check(false)] }).blocked).toMatch(
      /1 check still open/,
    );
    expect(nextStage({ stage: "qa", checklist: [check(true)] }).blocked).toBeUndefined();
  });

  it("waits for the client during client review", () => {
    expect(nextStage({ stage: "client_review", checklist: [] }).blocked).toMatch(/client/);
  });
});
