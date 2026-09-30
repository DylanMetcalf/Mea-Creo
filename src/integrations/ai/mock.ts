import { health } from "../types";
import type { AIGenerateRequest, AIGenerateResult, AIProvider } from "./types";

/**
 * Deterministic echo model for development and tests. Output is clearly labelled
 * so it can never be mistaken for real analysis.
 */
export class MockAIProvider implements AIProvider {
  readonly kind = "ai" as const;
  readonly provider = "mock";
  readonly isMock = true;
  readonly defaultModel = "mock-model";
  readonly calls: AIGenerateRequest[] = [];

  async healthCheck() {
    return health(this, "CONNECTED", "Mock AI. Responses are placeholders, not analysis.");
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
    this.calls.push(request);
    const last = request.messages.at(-1)?.content ?? "";
    const text = `[MOCK AI RESPONSE] ${last.slice(0, 200)}`;
    const outputTokens = Math.min(request.maxTokens, estimateTokens(text));
    return {
      text,
      model: request.model ?? this.defaultModel,
      usage: {
        inputTokens: estimateTokens(
          (request.system ?? "") + request.messages.map((m) => m.content).join(""),
        ),
        outputTokens,
      },
      stopReason: "end",
    };
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
