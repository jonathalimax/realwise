import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PremiumEntitlementsService } from './premium-entitlements.service';
import { StripeWebhookController } from './stripe.webhook.controller';
import { MercadoPagoWebhookController } from './mercadopago.webhook.controller';

@Module({
  imports: [DrizzleModule, AuthModule, NotificationsModule],
  controllers: [
    PaymentsController,
    StripeWebhookController,
    MercadoPagoWebhookController,
  ],
  providers: [PaymentsService, PremiumEntitlementsService],
})
export class PaymentsModule {}
