import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Put, Query, UseGuards } from '@nestjs/common';
import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  AiSettings,
  AnnouncementSettings,
  DEFAULT_EMAIL_SETTINGS,
  EmailSettings,
  ENGAGEMENT_KINDS,
  EngagementKind,
} from '../app-settings/app-settings.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BillRemindersService } from '../bill-reminders/bill-reminders.service';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { reminderEmailsSent, users } from '../db/schema';
import { EngagementRemindersService } from '../engagement-reminders/engagement-reminders.service';
import { modelFor } from '../llm/openrouter.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminActorService } from './admin-actor.service';
import { pageParams } from './pagination';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,120}$/;

const AI_NUMBERS = ['monthlyBudgetUsd', 'trialBudgetUsd', 'hardCapMultiplier'] as const;
const AI_MODELS = ['modelChat', 'modelChatLight', 'modelInsights', 'modelFallback'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly settings: AppSettingsService,
    private readonly notifications: NotificationsService,
    private readonly engagement: EngagementRemindersService,
    private readonly bills: BillRemindersService,
    private readonly actor: AdminActorService,
  ) {}

  // ---- AI --------------------------------------------------------------------------------------------------

  @Get('settings/ai')
  getAi() {
    return this.aiView();
  }

  /** Body fields present replace the stored value, `null` clears it (back to env/default), absent fields are kept. */
  @Put('settings/ai')
  async putAi(@CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    if (!isObj(body)) throw new BadRequestException('Corpo inválido');
    const next: Record<string, unknown> = { ...(await this.settings.getAi()) };
    for (const key of AI_NUMBERS) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null || v === '') { delete next[key]; continue; }
      const n = Number(v);
      if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > 100000) throw new BadRequestException(`${key} deve ser um número >= 0`);
      if (key === 'hardCapMultiplier' && n <= 1) throw new BadRequestException('hardCapMultiplier deve ser maior que 1');
      next[key] = n;
    }
    for (const key of AI_MODELS) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null || v === '') { delete next[key]; continue; }
      if (typeof v !== 'string' || !MODEL_RE.test(v.trim())) throw new BadRequestException(`${key} inválido`);
      next[key] = v.trim();
    }
    if ('promptCache' in body) {
      if (body.promptCache === null) delete next.promptCache;
      else if (typeof body.promptCache === 'boolean') next.promptCache = body.promptCache;
      else throw new BadRequestException('promptCache deve ser booleano');
    }
    await this.settings.set('ai', next, await this.actor.email(admin));
    await this.actor.record(admin, { action: 'settings.ai.update', targetLabel: 'ai', details: { settings: next } });
    return this.aiView();
  }

  /** Stored values (null when unset) plus what is effectively in force after env/default fallback. */
  private async aiView() {
    const ai = await this.settings.getAi();
    const env = (k: string) => process.env[k]?.trim() || undefined;
    const num = (stored: number | undefined, key: string, fallback: number) => stored ?? (env(key) !== undefined ? Number(env(key)) : fallback);
    const stored = Object.fromEntries(
      [...AI_NUMBERS, ...AI_MODELS, 'promptCache'].map((k) => [k, (ai as Record<string, unknown>)[k] ?? null]),
    );
    return {
      ...stored,
      effective: {
        monthlyBudgetUsd: num(ai.monthlyBudgetUsd, 'LLM_MONTHLY_BUDGET_USD', 5),
        trialBudgetUsd: num(ai.trialBudgetUsd, 'LLM_TRIAL_BUDGET_USD', 0.15),
        hardCapMultiplier: num(ai.hardCapMultiplier, 'LLM_HARD_CAP_MULTIPLIER', 3),
        modelChat: modelFor({ purpose: 'chat' } as never, ai),
        modelChatLight: modelFor({ purpose: 'chat', tier: 'light' } as never, ai),
        modelInsights: modelFor({ purpose: 'insights' } as never, ai),
        modelFallback: ai.modelFallback?.trim() || env('LLM_MODEL_FALLBACK') || null,
        promptCache: ai.promptCache ?? process.env.LLM_PROMPT_CACHE !== 'off',
      },
    };
  }

  // ---- emails ----------------------------------------------------------------------------------------------

  @Get('settings/emails')
  getEmails() {
    return this.settings.getEmails();
  }

  @Put('settings/emails')
  async putEmails(@CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    if (!isObj(body)) throw new BadRequestException('Corpo inválido');
    const next: EmailSettings = await this.settings.getEmails();
    const flag = (v: unknown, label: string) => {
      if (typeof v !== 'boolean') throw new BadRequestException(`${label} deve ser booleano`);
      return v;
    };
    const hour = (v: unknown, label: string) => {
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 23) throw new BadRequestException(`${label} deve ser um inteiro de 0 a 23`);
      return v as number;
    };
    if (body.engagement !== undefined) {
      const e = body.engagement;
      if (!isObj(e)) throw new BadRequestException('engagement inválido');
      if (e.enabled !== undefined) next.engagement.enabled = flag(e.enabled, 'engagement.enabled');
      if (e.hourBrt !== undefined) next.engagement.hourBrt = hour(e.hourBrt, 'engagement.hourBrt');
      if (e.kinds !== undefined) {
        if (!isObj(e.kinds)) throw new BadRequestException('engagement.kinds inválido');
        for (const [kind, v] of Object.entries(e.kinds)) {
          if (!ENGAGEMENT_KINDS.includes(kind as EngagementKind)) throw new BadRequestException(`Tipo desconhecido: ${kind}`);
          if (!isObj(v)) throw new BadRequestException(`engagement.kinds.${kind} inválido`);
          if (v.enabled !== undefined) next.engagement.kinds[kind as EngagementKind].enabled = flag(v.enabled, `engagement.kinds.${kind}.enabled`);
        }
      }
    }
    if (body.billReminders !== undefined) {
      const b = body.billReminders;
      if (!isObj(b)) throw new BadRequestException('billReminders inválido');
      if (b.enabled !== undefined) next.billReminders.enabled = flag(b.enabled, 'billReminders.enabled');
      if (b.hourBrt !== undefined) next.billReminders.hourBrt = hour(b.hourBrt, 'billReminders.hourBrt');
    }
    await this.settings.set('emails', next, await this.actor.email(admin));
    await this.actor.record(admin, { action: 'settings.emails.update', targetLabel: 'emails', details: { settings: next } });
    return next;
  }

  /** Sends a sample of one email kind ('bills' for the bill reminder) to `to`. */
  @Post('settings/emails/test')
  @HttpCode(200)
  async testEmail(@CurrentUser() admin: JwtPayload, @Body() body: { kind?: string; to?: string }) {
    const kind = body?.kind;
    if (!kind || ![...ENGAGEMENT_KINDS, 'bills'].includes(kind)) throw new BadRequestException(`kind deve ser um de: ${[...ENGAGEMENT_KINDS, 'bills'].join(', ')}`);
    if (!body?.to || !EMAIL_RE.test(body.to)) throw new BadRequestException('Informe um e-mail válido em "to".');
    if (kind === 'bills') {
      const today = new Date().toISOString().slice(0, 10);
      await this.notifications.sendBillReminderEmail(body.to, {
        overdue: [{ id: 'sample-1', name: 'Conta de exemplo (atrasada)', amount: '120.50', dueDate: today, daysOverdue: 2 }],
        dueToday: [{ id: 'sample-2', name: 'Conta de exemplo (hoje)', amount: '89.90', dueDate: today }],
        dueSoon: [{ id: 'sample-3', name: 'Conta de exemplo (em breve)', amount: '45.00', dueDate: today }],
      });
    } else {
      await this.notifications.sendEngagementEmail(body.to, kind as EngagementKind, {
        name: 'Maria',
        trialDaysRemaining: 3,
        unsubscribeUserId: '00000000-0000-0000-0000-000000000000',
        unsubscribeToken: 'sample',
        now: new Date(),
        suggestion: kind === 'bill_suggestion' ? { id: 'sample', name: 'Netflix', amount: '55.90', dayOfMonth: 12, dismissUrl: 'https://realwise.com.br' } : undefined,
      });
    }
    await this.actor.record(admin, { action: 'emails.test_send', details: { kind, to: body.to } });
    return { ok: true };
  }

  /** Runs a reminder job immediately. Engagement still honors per-kind toggles and its own dedup. */
  @Post('emails/run-now')
  @HttpCode(200)
  async runNow(@CurrentUser() admin: JwtPayload, @Body() body: { job?: string }) {
    if (body?.job !== 'engagement' && body?.job !== 'bills') throw new BadRequestException('job deve ser "engagement" ou "bills".');
    let result: Record<string, unknown>;
    if (body.job === 'engagement') {
      const r = await this.engagement.runForAllUsers();
      result = { job: 'engagement', ok: true, sent: r.sent, skipped: r.skipped };
    } else {
      await this.bills.runForAllUsers();
      result = { job: 'bills', ok: true };
    }
    await this.actor.record(admin, { action: 'emails.run_now', targetLabel: body.job, details: result });
    return result;
  }

  @Get('emails/sent')
  async sent(@Query('kind') kind?: string, @Query('email') email?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = pageParams(page, pageSize);
    const where = and(
      kind ? eq(reminderEmailsSent.kind, kind) : undefined,
      email?.trim() ? ilike(users.email, `%${email.trim().replace(/[%_\\]/g, '\\$&')}%`) : undefined,
    );
    const [items, [total]] = await Promise.all([
      this.db
        .select({
          id: reminderEmailsSent.id,
          userId: reminderEmailsSent.userId,
          email: users.email,
          name: users.name,
          kind: reminderEmailsSent.kind,
          periodKey: reminderEmailsSent.periodKey,
          sentAt: reminderEmailsSent.sentAt,
        })
        .from(reminderEmailsSent)
        .innerJoin(users, eq(users.id, reminderEmailsSent.userId))
        .where(where)
        .orderBy(desc(reminderEmailsSent.sentAt))
        .limit(p.pageSize)
        .offset(p.offset),
      this.db.select({ n: count() }).from(reminderEmailsSent).innerJoin(users, eq(users.id, reminderEmailsSent.userId)).where(where),
    ]);
    return { items, total: total?.n ?? 0, page: p.page, pageSize: p.pageSize };
  }

  // ---- announcement ----------------------------------------------------------------------------------------

  @Get('settings/announcement')
  async getAnnouncement(): Promise<AnnouncementSettings> {
    return (await this.settings.getAnnouncement()) ?? { enabled: false, text: '', level: 'info', linkLabel: null, linkUrl: null, until: null };
  }

  @Put('settings/announcement')
  async putAnnouncement(@CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    if (!isObj(body)) throw new BadRequestException('Corpo inválido');
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (typeof body.enabled !== 'boolean') throw new BadRequestException('enabled deve ser booleano');
    if (text.length > 300) throw new BadRequestException('O texto pode ter no máximo 300 caracteres.');
    if (body.enabled && !text) throw new BadRequestException('Informe o texto do aviso.');
    const level = body.level ?? 'info';
    if (level !== 'info' && level !== 'warning' && level !== 'promo') throw new BadRequestException('level deve ser info, warning ou promo.');
    const linkLabel = typeof body.linkLabel === 'string' && body.linkLabel.trim() ? body.linkLabel.trim().slice(0, 60) : null;
    let linkUrl: string | null = null;
    if (typeof body.linkUrl === 'string' && body.linkUrl.trim()) {
      linkUrl = body.linkUrl.trim();
      if (!/^https?:\/\/\S+$/i.test(linkUrl) && !/^\/[^\s/]\S*$|^\/$/.test(linkUrl)) throw new BadRequestException('linkUrl deve ser http(s) ou um caminho começando com /.');
    }
    let until: string | null = null;
    if (typeof body.until === 'string' && body.until) {
      const d = new Date(body.until);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('until deve ser uma data ISO válida.');
      until = d.toISOString();
    }
    const value: AnnouncementSettings = { enabled: body.enabled, text, level, linkLabel, linkUrl, until };
    await this.settings.set('announcement', value, await this.actor.email(admin));
    await this.actor.record(admin, { action: 'settings.announcement.update', targetLabel: 'announcement', details: { ...value } });
    return value;
  }
}
