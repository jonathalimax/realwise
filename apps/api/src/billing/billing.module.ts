import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeClient } from './stripe-client';
import { WebhookHealthService } from './webhook-health.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeWebhookService, StripeClient, WebhookHealthService],
  exports: [BillingService, StripeClient, WebhookHealthService],
})
export class BillingModule {}
