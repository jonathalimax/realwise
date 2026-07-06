import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post()
  async handle(@Body() body: { type?: string; data?: { id?: string | number } }) {
    const paymentId = body?.data?.id;
    if (body?.type !== 'payment' || !paymentId) {
      return { received: true, ignored: true };
    }

    const payment = await this.paymentsService.fetchMercadoPagoPayment(String(paymentId));
    if (payment?.status === 'approved') {
      await this.paymentsService.handleMercadoPagoPaymentApproved(payment);
    }

    return { received: true };
  }
}
