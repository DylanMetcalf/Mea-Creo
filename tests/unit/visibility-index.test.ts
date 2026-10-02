import { describe, expect, it } from "vitest";
import type { AuditFinding, AuditResult } from "@/modules/audits/types";
import { bandFor, visibilityIndex } from "@/modules/audits/visibility-index";

const f = (
  status: AuditFinding["status"],
  impact: AuditFinding["impact"] = "medium",
): AuditFinding => ({
  id: Math.random().toString(36),
  status,
  impact,
  title: "t",
  whatIsHappening: "",
  whyItMatters: "",
  whatToDo: "",
});

const result = (categories: { key: string; findings: AuditFinding[] }[]) =>
  ({
    categories: categories.map((c) => ({ ...c, label: c.key, status: "strong", summary: "" })),
  }) as unknown as AuditResult;

describe("Mea Creo Visibility Index", () => {
  it("weights by impact, counts warnings as half, and ignores unmeasured items", () => {
    const idx = visibilityIndex(
      result([
        // pass(high 3×1) + fail(low 1×0) → 3/4 = 75
        { key: "search", findings: [f("pass", "high"), f("fail", "low"), f("not_measured")] },
        // warn(medium) → 50
        { key: "content", findings: [f("warn"), f("info")] },
        // nothing checkable → left out, not zero
        { key: "local", findings: [f("not_measured")] },
        // competitors never count
        { key: "competitors", findings: [f("fail", "high")] },
      ]),
    )!;
    expect(idx.areas.find((a) => a.key === "search")!.score).toBe(75);
    expect(idx.areas.find((a) => a.key === "content")!.score).toBe(50);
    expect(idx.areas.find((a) => a.key === "local")!.score).toBeNull();
    expect(idx.areas.some((a) => a.key === "competitors")).toBe(false);
    expect(idx.measuredAreas).toBe(2);
    expect(idx.score).toBe(63);
    expect(idx.band).toBe("visible");
  });

  it("returns nothing when no area could be measured", () => {
    expect(visibilityIndex(result([{ key: "search", findings: [f("not_measured")] }]))).toBeNull();
  });

  it("bands the score", () => {
    expect([85, 60, 45, 10].map(bandFor)).toEqual([
      "strong",
      "visible",
      "partly_visible",
      "hard_to_find",
    ]);
  });
});
