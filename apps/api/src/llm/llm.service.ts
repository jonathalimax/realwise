import { HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { llmCallLog } from '../db/schema';
import { estimateCostUsd } from './model-pricing';
import { LLM_PROVIDER } from './llm.types';
import type { LlmProvider, LlmRequest, LlmResult } from './llm.types';

const DEFAULT_MONTHLY_BUDGET_USD = 5;
const DEFAULT_HARD_CAP_MULTIPLIER = 3;

@Injectable()
export class LlmService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {}

  isAvailable(): boolean {
    return this.provider.isConfigured();
  }

  /** Runs one model call for a user, enforcing the monthly budget and logging usage/cost. */
  async generate(
    req: LlmRequest,
    scope: { clientId: string; userId: string },
    onText?: (delta: string) => void,
  ): Promise<LlmResult> {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('AI assistant is not configured');
    }
    // Over the monthly budget: switch to the cheaper fallback model, until a hard cap (budget x multiplier) stops it.
    const request = await this.applyBudget(req, scope.userId);

    try {
      const result =
        onText && this.provider.generateStream
          ? await this.provider.generateStream(request, onText)
          : await this.provider.generate(request);
      const usd = estimateCostUsd(
        result.provider,
        result.model,
        result.inputTokens,
        result.outputTokens,
        result.cachedInputTokens,
        result.cacheWriteTokens,
      );
      await this.log(scope, request, result, usd);
      return result;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      // The real cause goes to the server log and llm_call_log; users only get a generic message.
      console.error(`[llm] ${request.purpose} call failed for model ${request.model ?? 'default'}: ${reason}`);
      await this.log(scope, req, null, 0, reason);
      throw new ServiceUnavailableException('The AI assistant is temporarily unavailable. Please try again.');
    }
  }

  async monthToDateUsd(userId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const rows = await this.db
      .select({ micro: sql<number>`coalesce(sum(${llmCallLog.costMicroCents}), 0)` })
      .from(llmCallLog)
      .where(and(eq(llmCallLog.userId, userId), gte(llmCallLog.createdAt, monthStart)));
    // micro-cents -> USD
    return Number(rows[0]?.micro ?? 0) / 100 / 1_000_000;
  }

  private async applyBudget(req: LlmRequest, userId: string): Promise<LlmRequest> {
    // Unset or blank falls back to the default; an explicit 0 disables all caps.
    const raw = process.env.LLM_MONTHLY_BUDGET_USD?.trim();
    const budget = raw ? Number(raw) : DEFAULT_MONTHLY_BUDGET_USD;
    if (!Number.isFinite(budget) || budget <= 0) return req;

    const spent = await this.monthToDateUsd(userId);
    if (spent < budget) return req;

    const fallback = process.env.LLM_MODEL_FALLBACK?.trim();
    const multiplier = Number(process.env.LLM_HARD_CAP_MULTIPLIER?.trim() || DEFAULT_HARD_CAP_MULTIPLIER);
    const hardCap = budget * (Number.isFinite(multiplier) && multiplier > 1 ? multiplier : DEFAULT_HARD_CAP_MULTIPLIER);
    if (fallback && spent < hardCap) return { ...req, model: fallback };

    throw new HttpException('Monthly AI usage limit reached.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async log(
    scope: { clientId: string; userId: string },
    req: LlmRequest,
    result: LlmResult | null,
    usd: number,
    error?: string,
  ): Promise<void> {
    try {
      await this.db.insert(llmCallLog).values({
        clientId: scope.clientId,
        userId: scope.userId,
        purpose: req.purpose,
        provider: result?.provider ?? this.provider.name,
        model: result?.model ?? 'unknown',
        inputTokens: result?.inputTokens ?? 0,
        outputTokens: result?.outputTokens ?? 0,
        latencyMs: result?.latencyMs ?? 0,
        costMicroCents: Math.round(usd * 100 * 1_000_000),
        error,
      });
    } catch (e) {
      console.error('[llm] failed to write call log', e);
    }
  }
}
