import type { IntegrationAdapter } from "../types";

/**
 * Vendor-neutral model access. Agents (Phase 17) build on this; they never call a
 * vendor SDK directly. Usage is returned on every call so cost can be tracked.
 */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIGenerateRequest {
  system?: string;
  messages: AIMessage[];
  /** Hard ceiling on output tokens. Required so no call is unbounded. */
  maxTokens: number;
  model?: string;
  temperature?: number;
  /** Abort after this many milliseconds. */
  timeoutMs?: number;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIGenerateResult {
  text: string;
  model: string;
  usage: AIUsage;
  stopReason: "end" | "max_tokens" | "stop_sequence" | "refusal" | "other";
}

export interface AIProvider extends IntegrationAdapter {
  readonly kind: "ai";
  readonly defaultModel: string;
  generate(request: AIGenerateRequest): Promise<AIGenerateResult>;
}
