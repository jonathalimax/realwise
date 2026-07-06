import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post()
  async handle(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature = '',
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Stripe raw body is required');
    }

    const event = this.paymentsService.constructStripeEvent(rawBody, signature);
    if (event.type === 'checkout.session.completed') {
      await this.paymentsService.handleStripeCheckoutCompleted(event.data.object as {
        id: string;
        payment_intent?: string | null;
        amount_total?: number | null;
        customer_details?: { email?: string | null } | null;
        metadata?: Record<string, string | null | undefined> | null;
      });
    }

    return { received: true };
  }
}
