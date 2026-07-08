import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('session')
  createSession(@Body() dto: CreatePaymentSessionDto) {
    return this.paymentsService.createCheckoutSession(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('webhooks/stripe')
  handleStripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(req.rawBody, signature);
  }
}
