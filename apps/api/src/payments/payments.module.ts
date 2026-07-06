import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MercadoPagoWebhookController } from './mercadopago.webhook.controller';
import { MercadoPagoClient } from './mercadopago.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PremiumEntitlementsService } from './premium-entitlements.service';
import { StripeWebhookController } from './stripe.webhook.controller';

@Module({
  imports: [DrizzleModule, AuthModule, NotificationsModule],
  controllers: [
    PaymentsController,
    StripeWebhookController,
    MercadoPagoWebhookController,
  ],
  providers: [
    PaymentsService,
    PremiumEntitlementsService,
    MercadoPagoClient,
  ],
})
export class PaymentsModule {}
