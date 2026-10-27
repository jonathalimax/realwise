import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignsScheduler {
  private readonly logger = new Logger(CampaignsScheduler.name);

  constructor(private readonly campaigns: CampaignsService) {}

  // Starts scheduled campaigns that are due and resumes any stuck in 'sending' (e.g. the API restarted mid-send).
  @Cron('*/15 * * * *')
  async check(): Promise<void> {
    try {
      await this.campaigns.checkPending();
    } catch (e) {
      this.logger.error(`campaign check failed: ${(e as Error).message}`);
    }
  }
}
