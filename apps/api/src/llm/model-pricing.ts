// Approximate USD-per-million-token rates, for cost ESTIMATES only (budget guard), not billing.
// Unknown models are treated as $0 and warned about, never guessed.
const PRICING: Record<string, Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  openrouter: {
    'anthropic/claude-sonnet-5.5': { inputPerMillion: 3, outputPerMillion: 15 },
    'anthropic/claude-haiku-5.5': { inputPerMillion: 0.1, outputPerMillion: 0.5 },
  },
};

// Anthropic prompt caching: reads cost 10% of the input rate, writes 125%.
const CACHE_READ_FACTOR = 0.1;
const CACHE_WRITE_FACTOR = 1.25;

export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  cacheWriteTokens = 0,
): number {
  const rate = PRICING[provider]?.[model];
  if (!rate) {
    console.warn(`[llm] no pricing entry for ${provider}/${model}; cost estimate will be $0`);
    return 0;
  }
  const plain = Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens);
  const input =
    (plain + cachedInputTokens * CACHE_READ_FACTOR + cacheWriteTokens * CACHE_WRITE_FACTOR) * rate.inputPerMillion;
  return (input + outputTokens * rate.outputPerMillion) / 1_000_000;
}
