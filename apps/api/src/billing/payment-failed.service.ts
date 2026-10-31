import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type Stripe from 'stripe';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { reminderEmailsSent, users } from '../db/schema';
import { unsubscribeToken } from '../engagement-reminders/unsubscribe-token';
import { NotificationsService } from '../notifications/notifications.service';
import { computeAccess } from './access';

/**
 * First line of the dunning flow: when a renewal charge fails, tell the customer right away (once per invoice) and
 * point them at the page where they update the card. The reminder two days into the grace period is sent by the
 * hourly engagement job. Billing mail ignores the reminder opt-out: it is about their account, not marketing.
 */
@Injectable()
export class PaymentFailedService {
  private readonly logger = new Logger(PaymentFailedService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
    private readonly settings: AppSettingsService,
  ) {}

  async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      // The very first charge failing happens inside Checkout, which already shows the error to the customer.
      if (invoice.billing_reason === 'subscription_create' || !invoice.id) return;
      const { engagement } = await this.settings.getEmails();
      if (!engagement.enabled || !engagement.kinds.payment_failed.enabled) return;

      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const [user] = await this.db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
      if (!user) return;

      // Claim first (unique index), send second: Stripe retries the charge several times, each one fires this event.
      const claimed = await this.db
        .insert(reminderEmailsSent)
        .values({ userId: user.id, kind: 'payment_failed', periodKey: invoice.id })
        .onConflictDoNothing()
        .returning({ id: reminderEmailsSent.id });
      if (!claimed.length) return;

      const now = new Date();
      await this.notifications.sendEngagementEmail(user.email, 'payment_failed', {
        name: (user.name ?? '').split(' ')[0] || 'tudo bem',
        trialDaysRemaining: computeAccess(user, now).trialDaysRemaining,
        unsubscribeUserId: user.id,
        unsubscribeToken: unsubscribeToken(user.id),
        now,
        clientId: user.clientId,
      });
    } catch (e) {
      this.logger.error(`payment-failed e-mail for invoice ${invoice.id}: ${(e as Error).message}`);
    }
  }
}
