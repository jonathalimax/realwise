import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SummaryService } from './summary.service';

/** Set SUMMARY_EMAILS_ENABLED=false to stop every automatic summary e-mail (on-demand links keep working). */
const enabled = () => process.env.SUMMARY_EMAILS_ENABLED !== 'false';

@Injectable()
export class SummaryScheduler {
  private readonly logger = new Logger(SummaryScheduler.name);

  constructor(private readonly summaries: SummaryService) {}

  // Days 1 to 3 of the month at 09:30 Brasília. Each user's recap is sent once (already-sent ones are skipped), so the
  // extra days only catch users whose data or access was not ready on the 1st.
  @Cron('30 9 1-3 * *', { timeZone: 'America/Sao_Paulo' })
  async monthly(): Promise<void> {
    if (!enabled()) return;
    this.logger.log('Starting monthly summaries');
    await this.summaries.runMonthly();
  }

  @Cron('20 * * * *', { timeZone: 'America/Sao_Paulo' })
  async trialEnding(): Promise<void> {
    if (!enabled()) return;
    const { sent } = await this.summaries.runTrialEnding();
    if (sent > 0) this.logger.log(`Trial summaries sent: ${sent}`);
  }

  @Cron('0 4 * * *', { timeZone: 'America/Sao_Paulo' })
  async purge(): Promise<void> {
    await this.summaries.purgeExpired().catch((e) => this.logger.warn(`purge failed: ${String(e)}`));
  }
}
