import { Module } from '@nestjs/common';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StripeClient } from '../billing/stripe-client';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminInvoicingController } from './admin-invoicing.controller';
import { InvoicingScheduler } from './invoicing.scheduler';
import { InvoicingService } from './invoicing.service';
import { InvoicingSettingsService } from './invoicing-settings.service';

/** Notas fiscais (NFS-e) for paid Stripe invoices. BillingModule imports this one (not the other way round). */
@Module({
  imports: [DrizzleModule],
  controllers: [AdminInvoicingController],
  providers: [InvoicingService, InvoicingSettingsService, InvoicingScheduler, StripeClient, AdminGuard, AdminActorService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
