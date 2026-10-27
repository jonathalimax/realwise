import { Injectable } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import type { AiSettings } from '../app-settings/app-settings.types';
import type { LlmProvider, LlmRequest, LlmResult, LlmToolCall } from './llm.types';

const API_URL = process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions';

const STRONG_DEFAULT = 'anthropic/claude-sonnet-5.5';
const LIGHT_DEFAULT = 'anthropic/claude-haiku-5.5';

/**
 * Model per request. Documents (statements) use the strong model; plain Q&A, edits and insights use the light one.
 * Override per environment with LLM_MODEL_CHAT (strong), LLM_MODEL_CHAT_LIGHT and LLM_MODEL_INSIGHTS.
 */
export function modelFor(req: Pick<LlmRequest, 'purpose' | 'tier'>, ai: AiSettings = {}): string {
  const pick = (...values: (string | undefined)[]) => values.map((v) => v?.trim()).find(Boolean);
  const light = [ai.modelChatLight, process.env.LLM_MODEL_CHAT_LIGHT];
  if (req.purpose === 'insights') return pick(ai.modelInsights, process.env.LLM_MODEL_INSIGHTS, ...light) ?? LIGHT_DEFAULT;
  if (req.tier === 'light') return pick(...light) ?? LIGHT_DEFAULT;
  return pick(ai.modelChat, process.env.LLM_MODEL_CHAT) ?? STRONG_DEFAULT;
}

/**
 * Anthropic prompt caching through OpenRouter needs explicit breakpoints. The system prompt (accounts, categories,
 * rules) and the last user message (history + any attached document) are the big stable prefix that is re-sent on
 * every tool round, so cache up to both. Only Anthropic models take this; others get the messages untouched.
 */
export function withCacheBreakpoints(messages: LlmRequest['messages'], model: string, promptCache?: boolean): unknown[] {
  const enabled = promptCache ?? process.env.LLM_PROMPT_CACHE !== 'off';
  if (!model.startsWith('anthropic/') || !enabled) return messages;
  const mark = { cache_control: { type: 'ephemeral' } };
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  return messages.map((m, i) => {
    if (i !== lastUser && m.role !== 'system') return m;
    if (m.role === 'system') return { ...m, content: [{ type: 'text', text: m.content, ...mark }] };
    if (m.role !== 'user') return m;
    const parts: Record<string, unknown>[] =
      typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : [...m.content];
    const last = parts[parts.length - 1];
    // Breakpoints go on a text block (file/image parts may not carry one through the gateway).
    if (last.type === 'text') parts[parts.length - 1] = { ...last, ...mark };
    else parts.push({ type: 'text', text: '(fim dos anexos)', ...mark });
    return { ...m, content: parts };
  });
}

/**
 * Providers behind OpenRouter (Google, Bedrock, Azure) are stricter than Anthropic's own API about tool
 * schemas: JSON-Schema type unions (["string","null"]) and null enum members get rejected. Collapse them
 * to the plain type; the tool descriptions already say when a value may be omitted/null.
 */
export function simplifySchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplifySchema);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'type' && Array.isArray(v)) {
      out[k] = v.find((t) => t !== 'null') ?? 'string';
    } else if (k === 'enum' && Array.isArray(v)) {
      out[k] = v.filter((x) => x !== null);
    } else {
      out[k] = simplifySchema(v);
    }
  }
  return out;
}

interface SseChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
  }[];
  usage?: Usage;
  error?: { message?: string };
}

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
}

@Injectable()
export class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter';

  constructor(private readonly settings: AppSettingsService) {}

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  private buildBody(req: LlmRequest, model: string, stream: boolean, ai: AiSettings) {
    const hasPdf = req.messages.some(
      (m) => m.role === 'user' && Array.isArray(m.content) && m.content.some((p) => p.type === 'file'),
    );
    return JSON.stringify({
      model,
      messages: withCacheBreakpoints(req.messages, model, ai.promptCache),
      tools: req.tools?.length
        ? req.tools.map((t) => ({ type: 'function', function: { ...t, parameters: simplifySchema(t.parameters) } }))
        : undefined,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.2,
      // Financial documents: no upstream retention or training, same policy as the RealWise chat gateway.
      provider: { zdr: true, data_collection: 'deny' },
      // Sonnet reads PDFs natively; "native" avoids a lossy text-extraction step for scanned statements.
      plugins: hasPdf ? [{ id: 'file-parser', pdf: { engine: 'native' } }] : undefined,
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    });
  }

  private async post(body: string, timeoutMs: number): Promise<Response> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`OpenRouter request failed: ${res.status} ${detail}`);
    }
    return res;
  }

  async generate(req: LlmRequest): Promise<LlmResult> {
    const ai = await this.settings.getAi();
    const model = req.model ?? modelFor(req, ai);
    const start = Date.now();
    const res = await this.post(this.buildBody(req, model, false, ai), 120_000);

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[];
      usage?: Usage;
      error?: { message?: string };
    };
    if (data.error) throw new Error(`OpenRouter rejected request: ${data.error.message ?? 'unknown error'}`);

    const message = data.choices?.[0]?.message;
    return {
      text: message?.content ?? '',
      toolCalls: message?.tool_calls ?? [],
      provider: this.name,
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      cacheWriteTokens: data.usage?.prompt_tokens_details?.cache_write_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  }

  /** Same as generate(), but calls `onText` with each piece of text as the model produces it. */
  async generateStream(req: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const ai = await this.settings.getAi();
    const model = req.model ?? modelFor(req, ai);
    const start = Date.now();
    const res = await this.post(this.buildBody(req, model, true, ai), 180_000);
    if (!res.body) throw new Error('OpenRouter returned no stream body');

    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;
    let cacheWriteTokens = 0;
    // Tool calls arrive as fragments keyed by index: id/name once, arguments in many small pieces.
    const calls = new Map<number, LlmToolCall>();

    const handle = (chunk: SseChunk) => {
      if (chunk.error) throw new Error(`OpenRouter stream error: ${chunk.error.message ?? 'unknown error'}`);
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        cachedInputTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? cachedInputTokens;
        cacheWriteTokens = chunk.usage.prompt_tokens_details?.cache_write_tokens ?? cacheWriteTokens;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const call = calls.get(tc.index) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } };
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.function.name += tc.function.name;
        if (tc.function?.arguments) call.function.arguments += tc.function.arguments;
        calls.set(tc.index, call);
      }
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        // Comment lines (": OPENROUTER PROCESSING") are keep-alives.
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          handle(JSON.parse(payload) as SseChunk);
        } catch (e) {
          if (e instanceof SyntaxError) continue; // partial/garbled line: ignore
          throw e;
        }
      }
    }

    return {
      text,
      toolCalls: [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c).filter((c) => c.id && c.function.name),
      provider: this.name,
      model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cacheWriteTokens,
      latencyMs: Date.now() - start,
    };
  }
}
