import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MercadoPagoClient } from './mercadopago.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient],
})
export class PaymentsModule {}
