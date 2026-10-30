/** Why we are calling the model. Picks the model and shows up in the call log. */
export type LlmPurpose = 'chat' | 'insights';

export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  // PDFs: `file_data` is a data URL (data:application/pdf;base64,...).
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type LlmMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | LlmContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

/** 'strong' = the accurate (expensive) model, for reading documents; 'light' = the cheap model for Q&A and edits. */
export type LlmTier = 'strong' | 'light';

export interface LlmRequest {
  purpose: LlmPurpose;
  /** Defaults to 'strong' for chat (safe) and 'light' for insights. */
  tier?: LlmTier;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  /** Overrides the model chosen for the purpose (used for the over-budget fallback). */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult {
  text: string;
  toolCalls: LlmToolCall[];
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Part of inputTokens served from the prompt cache (billed at a fraction). */
  cachedInputTokens?: number;
  /** Part of inputTokens written to the prompt cache (billed at a premium). */
  cacheWriteTokens?: number;
  /** What the provider actually charged for this call (USD), when it reports it. Preferred over our estimate. */
  costUsd?: number;
  latencyMs: number;
}

/** Transport to a model vendor. Swap implementations without touching callers. */
export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(req: LlmRequest): Promise<LlmResult>;
  /** Optional: stream text deltas while generating. Falls back to generate() when absent. */
  generateStream?(req: LlmRequest, onText: (delta: string) => void): Promise<LlmResult>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';
