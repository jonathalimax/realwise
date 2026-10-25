import { Injectable } from '@nestjs/common';
import type { LlmProvider, LlmRequest, LlmResult, LlmToolCall } from './llm.types';

const API_URL = process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions';

/** Model per purpose. Override per environment; defaults favour accuracy for chat/extraction. */
function modelFor(purpose: LlmRequest['purpose']): string {
  if (purpose === 'insights') {
    return process.env.LLM_MODEL_INSIGHTS ?? process.env.LLM_MODEL_CHAT ?? 'anthropic/claude-sonnet-5.5';
  }
  return process.env.LLM_MODEL_CHAT ?? 'anthropic/claude-sonnet-5.5';
}

@Injectable()
export class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter';

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  async generate(req: LlmRequest): Promise<LlmResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const model = modelFor(req.purpose);
    const hasPdf = req.messages.some(
      (m) => m.role === 'user' && Array.isArray(m.content) && m.content.some((p) => p.type === 'file'),
    );
    const start = Date.now();

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: req.messages,
        tools: req.tools?.length
          ? req.tools.map((t) => ({ type: 'function', function: t }))
          : undefined,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.2,
        // Financial documents: no upstream retention or training, same policy as the RealWise chat gateway.
        provider: { zdr: true, data_collection: 'deny' },
        // Sonnet reads PDFs natively; "native" avoids a lossy text-extraction step for scanned statements.
        plugins: hasPdf ? [{ id: 'file-parser', pdf: { engine: 'native' } }] : undefined,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`OpenRouter request failed: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
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
      latencyMs: Date.now() - start,
    };
  }
}
