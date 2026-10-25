// Approximate USD-per-million-token rates, for cost ESTIMATES only (budget guard), not billing.
// Unknown models are treated as $0 and warned about, never guessed.
const PRICING: Record<string, Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  openrouter: {
    'anthropic/claude-sonnet-5.5': { inputPerMillion: 3, outputPerMillion: 15 },
    'anthropic/claude-haiku-5.5': { inputPerMillion: 0.1, outputPerMillion: 0.5 },
  },
};

export function estimateCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const rate = PRICING[provider]?.[model];
  if (!rate) {
    console.warn(`[llm] no pricing entry for ${provider}/${model}; cost estimate will be $0`);
    return 0;
  }
  return (inputTokens * rate.inputPerMillion + outputTokens * rate.outputPerMillion) / 1_000_000;
}
