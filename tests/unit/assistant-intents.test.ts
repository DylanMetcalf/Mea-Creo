import { describe, expect, it } from "vitest";
import { classifyQuestion } from "@/modules/assistant/service";

describe("Ask Mea Creo intents", () => {
  it.each([
    ["Explain my Visibility Index", "visibility"],
    ["How visible are we?", "visibility"],
    ["What changed this month?", "month"],
    ["What should we focus on next?", "next"],
    ["What needs my approval?", "approvals"],
    ["Explain the September report", "report"],
  ])("%s → %s", (q, intent) => expect(classifyQuestion(q)).toBe(intent));
});
