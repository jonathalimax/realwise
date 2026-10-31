import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { StripeClient } from '../billing/stripe-client';
import { RetentionSettingsService } from './retention-settings.service';
import { ensureCoupon } from './stripe-coupons';

export interface WinbackCode {
  code: string;
  percent: number;
  months: number;
  validDays: number;
}

/** Creates the personal, single-use promotion code that goes out in the 30- and 60-day win-back e-mails. */
@Injectable()
export class WinbackService {
  private readonly logger = new Logger(WinbackService.name);

  constructor(
    private readonly stripe: StripeClient,
    private readonly settings: RetentionSettingsService,
  ) {}

  /** Null when Stripe is unreachable or not configured: the caller then skips this send and tries again next hour. */
  async createCode(user: { id: string; stripeCustomerId: string | null }): Promise<WinbackCode | null> {
    try {
      const s = await this.settings.get();
      const stripe = this.stripe.get();
      const coupon = await ensureCoupon(stripe, `rw-winback-${s.winbackPercent}-${s.winbackMonths}m`, {
        name: `Realwise: volta com ${s.winbackPercent}% por ${s.winbackMonths} meses`,
        percentOff: s.winbackPercent,
        duration: 'repeating',
        months: s.winbackMonths,
      });
      const code = `VOLTEI${randomBytes(4).toString('hex').toUpperCase()}`;
      await stripe.promotionCodes.create({
        coupon,
        code,
        max_redemptions: 1,
        expires_at: Math.floor(Date.now() / 1000) + s.winbackValidDays * 86_400,
        ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : {}),
        metadata: { userId: user.id, kind: 'winback' },
      });
      return { code, percent: s.winbackPercent, months: s.winbackMonths, validDays: s.winbackValidDays };
    } catch (e) {
      this.logger.error(`could not create win-back code for ${user.id}: ${(e as Error).message}`);
      return null;
    }
  }
}
