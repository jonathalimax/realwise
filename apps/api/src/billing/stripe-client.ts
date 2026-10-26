import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

/** Thin injectable around the Stripe SDK so tests can replace `get()` with a stub. */
@Injectable()
export class StripeClient {
  private instance: Stripe | null = null;

  get(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new ServiceUnavailableException('Stripe is not configured');
    this.instance ??= new Stripe(secretKey);
    return this.instance;
  }
}
