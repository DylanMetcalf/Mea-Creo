import Anthropic from "@anthropic-ai/sdk";
import { health } from "../types";
import type { AIGenerateRequest, AIGenerateResult, AIProvider } from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/**
 * Anthropic (Claude) via the official SDK. REQUIRES CONFIGURATION: ANTHROPIC_API_KEY.
 *
 * - Thinking is always on for current Opus models; depth and spend are controlled with
 *   `effort` per agent (the default here is "low" for routine agent work).
 * - Server-side refusal fallback is enabled so a declined request is retried on an
 *   appropriate model inside the same call.
 */
export class AnthropicAIProvider implements AIProvider {
  readonly kind = "ai" as const;
  readonly provider = "anthropic";
  readonly isMock = false;
  readonly defaultModel: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
    this.defaultModel = model || DEFAULT_ANTHROPIC_MODEL;
  }

  async healthCheck() {
    try {
      await this.client.models.retrieve(this.defaultModel);
      return health(this, "CONNECTED", `Connected. Default model: ${this.defaultModel}.`);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError)
        return health(this, "ACTION_REQUIRED", "The Anthropic API key was rejected.");
      if (error instanceof Anthropic.NotFoundError)
        return health(this, "ERROR", `Model ${this.defaultModel} was not found.`);
      return health(
        this,
        "ERROR",
        `Anthropic API not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
    const response = await this.client.beta.messages.create(
      {
        model: request.model ?? this.defaultModel,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: request.effort ?? "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { timeout: request.timeoutMs ?? 120_000 },
    );

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const stopReason =
      response.stop_reason === "end_turn"
        ? "end"
        : response.stop_reason === "max_tokens"
          ? "max_tokens"
          : response.stop_reason === "stop_sequence"
            ? "stop_sequence"
            : response.stop_reason === "refusal"
              ? "refusal"
              : "other";

    return {
      text: stopReason === "refusal" ? "" : text,
      model: response.model,
      usage: {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_read_input_tokens ?? 0) +
          (response.usage.cache_creation_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
      stopReason,
    };
  }
}
