import { HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { imports, llmCallLog, users } from '../db/schema';
import { computeAccess } from '../billing/access';
import { estimateCostUsd } from './model-pricing';
import type { AiSettings } from '../app-settings/app-settings.types';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { LLM_PROVIDER } from './llm.types';
import type { LlmProvider, LlmRequest, LlmResult } from './llm.types';

// Per paying user per month. Past it Elio switches to the cheaper fallback model; the hard cap (budget x multiplier,
// multiplier must be above 1) stops it. A paid user is worth about US$ 2 net, so even the hard cap leaves a margin.
// Stored admin settings and per-user overrides win over these defaults (see applyBudget).
const DEFAULT_MONTHLY_BUDGET_USD = 1;
const DEFAULT_HARD_CAP_MULTIPLIER = 1.5;
// Trial users run on no card, so their AI spend is capped far below a paying user's (statements still use the strong model).
const DEFAULT_TRIAL_BUDGET_USD = 0.15;
// The first statement a trial user imports (and the follow-ups within a few minutes) is the "aha" moment, so it never
// counts against the trial cap. The allowance is itself capped so it cannot be abused.
const FIRST_IMPORT_ALLOWANCE_USD = 0.6;
const FIRST_IMPORT_GRACE_MINUTES = 10;

@Injectable()
export class LlmService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly settings: AppSettingsService,
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
      // The provider's own billed amount when it sends one; the rate table is only the fallback.
      const usd = result.costUsd ?? estimateCostUsd(
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
      throw new ServiceUnavailableException('O Elio está indisponível no momento. Tente de novo em instantes.');
    }
  }

  async monthToDateUsd(userId: string, since?: Date): Promise<number> {
    const monthStart = since ?? new Date();
    if (!since) {
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
    }
    const rows = await this.db
      .select({ micro: sql<number>`coalesce(sum(${llmCallLog.costMicroCents}), 0)` })
      .from(llmCallLog)
      .where(and(eq(llmCallLog.userId, userId), gte(llmCallLog.createdAt, monthStart)));
    // micro-cents -> USD
    return Number(rows[0]?.micro ?? 0) / 100 / 1_000_000;
  }

  /**
   * Trial spend that counts against the cap: everything except the user's first statement import. A call is part of
   * it when it read attached documents and the user had no earlier import (more than the grace minutes before the call).
   * The exempt part is limited to FIRST_IMPORT_ALLOWANCE_USD.
   */
  private async trialChargeableUsd(userId: string, since: Date): Promise<number> {
    const rows = await this.db.execute(sql`
      select coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as total,
             coalesce(sum(${llmCallLog.costMicroCents}) filter (where ${llmCallLog.statement} and not exists (
               select 1 from ${imports}
               where ${imports.userId} = ${llmCallLog.userId}
                 and ${imports.createdAt} < ${llmCallLog.createdAt} - make_interval(mins => ${FIRST_IMPORT_GRACE_MINUTES})
             )), 0)::float8 as exempt
      from ${llmCallLog}
      where ${llmCallLog.userId} = ${userId} and ${llmCallLog.createdAt} >= ${since.toISOString()}::timestamptz`);
    const row = (Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0]) as { total?: number; exempt?: number } | undefined;
    const toUsd = (micro: number) => micro / 100 / 1_000_000;
    return Math.max(0, toUsd(Number(row?.total ?? 0)) - Math.min(toUsd(Number(row?.exempt ?? 0)), FIRST_IMPORT_ALLOWANCE_USD));
  }

  private async applyBudget(req: LlmRequest, userId: string): Promise<LlmRequest> {
    const ai = await this.settings.getAi();
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    // Per-user admin override wins over the global/trial budgets (0 = no cap, same as the global setting).
    const override = user?.llmBudgetOverrideUsd != null ? Number(user.llmBudgetOverrideUsd) : null;
    const userOverride = override !== null && Number.isFinite(override) ? override : null;

    await this.enforceTrialCap(userId, user, ai, userOverride);
    // Stored setting > env > default. Unset or blank env falls back to the default; an explicit 0 disables all caps.
    const budget = userOverride ?? this.numberSetting(ai.monthlyBudgetUsd, process.env.LLM_MONTHLY_BUDGET_USD, DEFAULT_MONTHLY_BUDGET_USD);
    if (!Number.isFinite(budget) || budget <= 0) return req;

    const spent = await this.monthToDateUsd(userId);
    if (spent < budget) return req;

    const fallback = (ai.modelFallback?.trim() || process.env.LLM_MODEL_FALLBACK?.trim()) || undefined;
    const multiplier = this.numberSetting(ai.hardCapMultiplier, process.env.LLM_HARD_CAP_MULTIPLIER, DEFAULT_HARD_CAP_MULTIPLIER);
    const hardCap = budget * (Number.isFinite(multiplier) && multiplier > 1 ? multiplier : DEFAULT_HARD_CAP_MULTIPLIER);
    if (fallback && spent < hardCap) return { ...req, model: fallback };

    throw new HttpException(
      { message: 'Você chegou ao limite de uso do Elio neste mês. Ele volta a ficar disponível no começo do próximo mês.', code: 'MONTHLY_LIMIT' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Stored value if it is a number, else the env var (blank = unset), else the default. */
  private numberSetting(stored: number | undefined, envRaw: string | undefined, fallback: number): number {
    if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
    const raw = envRaw?.trim();
    return raw ? Number(raw) : fallback;
  }

  /** Trial users get a small AI allowance (since the trial started); past it they are asked to subscribe. */
  private async enforceTrialCap(
    userId: string,
    user: typeof users.$inferSelect | undefined,
    ai: AiSettings,
    userOverride: number | null,
  ): Promise<void> {
    const cap = userOverride ?? this.numberSetting(ai.trialBudgetUsd, process.env.LLM_TRIAL_BUDGET_USD, DEFAULT_TRIAL_BUDGET_USD);
    if (!Number.isFinite(cap) || cap <= 0) return; // 0 disables the trial cap

    if (!user || computeAccess(user, new Date()).state !== 'trial') return;

    const spent = await this.trialChargeableUsd(userId, user.premiumAccessStartedAt ?? user.createdAt);
    if (spent < cap) return;
    throw new HttpException(
      { message: 'Você usou todo o limite do teste grátis. Para continuar com o Elio, assine um plano.', code: 'TRIAL_LIMIT' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
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
        statement: req.statement ?? false,
      });
    } catch (e) {
      console.error('[llm] failed to write call log', e);
    }
  }
}
