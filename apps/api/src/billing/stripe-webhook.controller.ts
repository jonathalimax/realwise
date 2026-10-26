import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';
import { StripeClient } from './stripe-client';
import { StripeWebhookService } from './stripe-webhook.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripe: StripeClient,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature = '',
  ): Promise<{ received: true }> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new BadRequestException('Stripe webhook is not configured');
    if (!req.rawBody) throw new BadRequestException('Stripe raw body is required');
    if (!signature) throw new BadRequestException('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.get().webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    await this.webhooks.handleEvent(event);
    return { received: true };
  }
}
