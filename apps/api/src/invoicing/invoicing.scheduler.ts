import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoicingService } from './invoicing.service';

@Injectable()
export class InvoicingScheduler {
  private readonly logger = new Logger(InvoicingScheduler.name);
  private running = false;

  constructor(private readonly invoicing: InvoicingService) {}

  /** Every 2 minutes: emit queued notas and follow up on the ones the Prefeitura is still authorizing. */
  @Cron('*/2 * * * *')
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const res = await this.invoicing.tick();
      if (res.emitted || res.refreshed) this.logger.log(`notas: ${res.emitted} enviadas, ${res.refreshed} consultadas`);
    } catch (e) {
      this.logger.error(`invoicing tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
