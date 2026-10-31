import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { InvoicingModule } from '../invoicing/invoicing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentFailedService } from './payment-failed.service';
import { StripeClient } from './stripe-client';
import { WebhookHealthService } from './webhook-health.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [DrizzleModule, NotificationsModule, InvoicingModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, StripeWebhookService, StripeClient, WebhookHealthService, PaymentFailedService],
  exports: [BillingService, StripeClient, WebhookHealthService],
})
export class BillingModule {}
