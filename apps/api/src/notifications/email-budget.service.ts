import { Injectable, Logger } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';

export type EmailPriority = 'essential' | 'bulk';

interface Usage {
  day: string;
  dayCount: number;
  month: string;
  monthCount: number;
}

const num = (v: string | undefined, fallback: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

/**
 * Keeps the mail provider's free-tier allowance (default 100 a day, 3000 a month) from running out. Essential
 * mail (support replies, billing, the welcome) may use all of it; bulk mail (reminders, summaries, campaigns)
 * stops earlier and leaves a reserve, so a busy day can never block a payment-failed or support e-mail.
 * Counts live in `app_settings` so they survive restarts; one API instance is assumed.
 */
@Injectable()
export class EmailBudgetService {
  private readonly logger = new Logger(EmailBudgetService.name);
  private usage: Usage | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly settings: AppSettingsService) {}

  private get limits() {
    const day = num(process.env.EMAIL_DAILY_LIMIT, 100);
    const month = num(process.env.EMAIL_MONTHLY_LIMIT, 3000);
    return {
      day,
      month,
      bulkDay: Math.max(0, day - num(process.env.EMAIL_RESERVE_DAILY, 25)),
      bulkMonth: Math.max(0, month - num(process.env.EMAIL_RESERVE_MONTHLY, 300)),
    };
  }

  private async load(now = new Date()): Promise<Usage> {
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const stored = this.usage ?? (await this.settings.get<Usage>('email_usage')) ?? { day, dayCount: 0, month, monthCount: 0 };
    this.usage = {
      day,
      dayCount: stored.day === day ? stored.dayCount : 0,
      month,
      monthCount: stored.month === month ? stored.monthCount : 0,
    };
    return this.usage;
  }

  async canSend(priority: EmailPriority): Promise<boolean> {
    const u = await this.load();
    const l = this.limits;
    return priority === 'essential' ? u.dayCount < l.day && u.monthCount < l.month : u.dayCount < l.bulkDay && u.monthCount < l.bulkMonth;
  }

  /** How many more bulk e-mails may go out right now. */
  async bulkRemaining(): Promise<number> {
    const u = await this.load();
    const l = this.limits;
    return Math.max(0, Math.min(l.bulkDay - u.dayCount, l.bulkMonth - u.monthCount));
  }

  async record(): Promise<void> {
    const u = await this.load();
    u.dayCount += 1;
    u.monthCount += 1;
    const snapshot = { ...u };
    this.writing = this.writing.then(() => this.settings.set('email_usage', snapshot).catch((e: Error) => this.logger.warn(`could not save e-mail usage: ${e.message}`)));
    await this.writing;
    const l = this.limits;
    if (u.dayCount === l.bulkDay || u.monthCount === l.bulkMonth) this.logger.warn(`[email] bulk budget reached (day ${u.dayCount}/${l.day}, month ${u.monthCount}/${l.month}); only essential mail goes out now`);
  }

  async snapshot() {
    const u = await this.load();
    return { ...u, dayLimit: this.limits.day, monthLimit: this.limits.month };
  }
}

export class EmailBudgetError extends Error {
  constructor() {
    super('E-mail budget exhausted for now');
  }
}
