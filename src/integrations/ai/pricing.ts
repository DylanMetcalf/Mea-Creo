/**
 * Model pricing in USD per million tokens, for cost tracking and budgets.
 * Source: Anthropic first-party API pricing (cached 2026-09-25). Verify against the
 * provider's pricing page before relying on it for billing decisions.
 */
export const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "mock-model": { inputPerMTok: 0, outputPerMTok: 0 },
};

/** Estimated cost in micro-USD (1e-6 USD), integer, for exact aggregation. */
export function estimateCostMicroUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICING[model] ?? MODEL_PRICING["claude-opus-5-5"];
  return Math.round(inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok);
}

export function formatMicroUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(micro < 10_000 ? 4 : 2)}`;
}
