import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoicingService } from './invoicing.service';

const FOLLOW_UPS = 6;
const FOLLOW_UP_GAP_MS = 30_000;

@Injectable()
export class InvoicingScheduler {
  private readonly logger = new Logger(InvoicingScheduler.name);
  private running = false;

  constructor(private readonly invoicing: InvoicingService) {}

  /**
   * Monday, Wednesday and Friday at 10:00 (Brasília): emit what is queued, then check back a few times within the
   * same run, because the Prefeitura usually authorizes within seconds. Anything still pending is picked up by the
   * next run or by the admin's "Atualizar" button.
   */
  @Cron('0 10 * * 1,3,5', { timeZone: 'America/Sao_Paulo' })
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const first = await this.invoicing.tick();
      let refreshed = first.refreshed;
      for (let i = 0; i < FOLLOW_UPS && (await this.invoicing.hasProcessing()); i += 1) {
        await new Promise((r) => setTimeout(r, FOLLOW_UP_GAP_MS));
        refreshed += (await this.invoicing.tick()).refreshed;
      }
      if (first.emitted || refreshed) this.logger.log(`notas: ${first.emitted} enviadas, ${refreshed} consultas`);
    } catch (e) {
      this.logger.error(`invoicing run failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
