import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { coupons, leads, pricingConfig } from '../db/schema';
import { PremiumEntitlementsService } from './premium-entitlements.service';

type StripeCheckoutSessionLike = {
  id: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string | null | undefined> | null;
};

type MercadoPagoPaymentLike = {
  id: number | string;
  status?: string | null;
  transaction_amount?: number | null;
  payer?: { email?: string | null } | null;
  metadata?: Record<string, string | null | undefined> | null;
};

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly entitlements: PremiumEntitlementsService,
  ) {}

  private getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('Stripe secret key is not configured');
    }
    return new Stripe(secretKey);
  }

  private async getPricing() {
    const rows = await this.db
      .select()
      .from(pricingConfig)
      .where(eq(pricingConfig.configKey, 'landing-pricing'));

    const row = rows[0];
    return {
      basePriceCents: row?.basePriceCents ?? 23880,
      compareAtPriceCents: row?.compareAtPriceCents ?? 47988,
      installments: row?.installments ?? 12,
      stripeWalletEnabled: row?.stripeWalletEnabled ?? true,
      mercadopagoEnabled: row?.mercadopagoEnabled ?? true,
    };
  }

  private async findValidCoupon(couponCode?: string | null) {
    if (!couponCode?.trim()) {
      return null;
    }

    const normalizedCode = couponCode.trim().toUpperCase();
    const rows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, normalizedCode));

    const coupon = rows[0];
    if (!coupon || coupon.enabled === false) {
      throw new BadRequestException('Cupom invalido ou expirado.');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Cupom invalido ou expirado.');
    }
    if (coupon.maxUses != null && coupon.useCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom invalido ou expirado.');
    }

    return coupon;
  }

  private calculateAmount(basePriceCents: number, coupon: any) {
    if (!coupon) return basePriceCents;

    const rawValue = Number(coupon.discountValue ?? 0);
    if (coupon.discountType === 'percent' || coupon.discountType === 'percentage') {
      const next = Math.round(basePriceCents * (1 - rawValue / 100));
      return Math.max(0, next);
    }
    if (coupon.discountType === 'fixed' || coupon.discountType === 'fixed_amount') {
      return Math.max(0, basePriceCents - Math.round(rawValue));
    }

    return basePriceCents;
  }

  private async recordLead(input: {
    email: string;
    name?: string | null;
    clientId?: string | null;
    couponCode?: string | null;
    feature?: string | null;
    whatsapp?: string | null;
    utmSource?: string | null;
  }) {
    await this.db.insert(leads).values({
      email: input.email,
      name: input.name ?? null,
      plan: 'premium',
      status: 'checkout_started',
      updatedAt: new Date(),
      metadata: {
        source: 'payments-api',
        clientId: input.clientId ?? null,
        couponCode: input.couponCode ?? null,
        feature: input.feature ?? null,
        whatsapp: input.whatsapp ?? null,
        utmSource: input.utmSource ?? null,
      },
    });
  }

  private async incrementCouponUse(couponCode?: string | null) {
    if (!couponCode?.trim()) return;

    await this.db
      .update(coupons)
      .set({
        useCount: sql`${coupons.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.code, couponCode.trim().toUpperCase()));
  }

  async createStripeCheckout(input: {
    email: string;
    name?: string | null;
    whatsapp?: string | null;
    couponCode?: string | null;
    clientId?: string | null;
    feature?: string | null;
    utmSource?: string | null;
  }) {
    if (!input.email?.trim()) {
      throw new BadRequestException('email e obrigatorio.');
    }

    const pricing = await this.getPricing();
    if (!pricing.stripeWalletEnabled) {
      throw new BadRequestException('Carteiras digitais estao desabilitadas no momento.');
    }
    const stripe = this.getStripeClient();
    const coupon = await this.findValidCoupon(input.couponCode);
    const amountCents = this.calculateAmount(pricing.basePriceCents, coupon);

    await this.recordLead(input);

    const frontendBaseUrl = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '');
    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: input.email.trim().toLowerCase(),
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: amountCents,
          product_data: {
            name: 'Realwise Premium',
            description: input.feature ? `Unlock ${input.feature}` : 'Unlock premium tools',
          },
        },
      }],
      success_url: `${frontendBaseUrl}/purchase-success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl}/checkout?cancelled=1${input.feature ? `&feature=${encodeURIComponent(input.feature)}` : ''}`,
      metadata: {
        clientId: input.clientId ?? '',
        name: input.name ?? '',
        whatsapp: input.whatsapp ?? '',
        couponCode: coupon?.code ?? '',
        feature: input.feature ?? '',
        utmSource: input.utmSource ?? '',
      },
    });

    return { url: checkoutSession.url };
  }

  async createMercadoPagoQuote(input: {
    email: string;
    name?: string | null;
    whatsapp?: string | null;
    couponCode?: string | null;
    clientId?: string | null;
    feature?: string | null;
    utmSource?: string | null;
  }) {
    if (!input.email?.trim()) {
      throw new BadRequestException('email e obrigatorio.');
    }

    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) {
      throw new BadRequestException('Configuração de pagamento ausente.');
    }

    const pricing = await this.getPricing();
    if (!pricing.mercadopagoEnabled) {
      throw new BadRequestException('Pix e cartao estao desabilitados no momento.');
    }
    const coupon = await this.findValidCoupon(input.couponCode);
    const amountCents = this.calculateAmount(pricing.basePriceCents, coupon);

    await this.recordLead(input);

    return {
      publicKey,
      amount: amountCents / 100,
      baseAmount: pricing.basePriceCents / 100,
      couponCode: coupon?.code ?? null,
      installments: pricing.installments,
    };
  }

  async processMercadoPagoPayment(input: {
    token?: string | null;
    issuer_id?: string | null;
    payment_method_id?: string | null;
    transaction_amount?: number | null;
    installments?: number | null;
    payer?: Record<string, unknown> | null;
    email: string;
    name?: string | null;
    whatsapp?: string | null;
    couponCode?: string | null;
    clientId?: string | null;
    feature?: string | null;
  }) {
    const email = input.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('email e obrigatorio.');
    }

    const pricing = await this.getPricing();
    if (!pricing.mercadopagoEnabled) {
      throw new BadRequestException('Pix e cartao estao desabilitados no momento.');
    }

    if ((input.transaction_amount ?? 0) <= 0) {
      const result = await this.entitlements.unlockPremiumAccess({
        clientId: input.clientId,
        email,
        name: input.name ?? null,
        amount: 0,
        paymentProvider: 'mercadopago',
        providerPaymentId: `free-${Date.now()}`,
        metadata: {
          couponCode: input.couponCode?.trim().toUpperCase() ?? null,
          source: 'free-coupon',
        },
      });
      if (!result.alreadyProcessed) {
        await this.incrementCouponUse(input.couponCode);
      }
      return { status: 'approved' };
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new BadRequestException('Mercado Pago access token is not configured');
    }

    const apiBaseUrl = (process.env.API_BASE_URL ?? 'https://api.realwise.com.br').replace(/\/$/, '');
    const response = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      {
        token: input.token,
        issuer_id: input.issuer_id,
        payment_method_id: input.payment_method_id,
        transaction_amount: input.transaction_amount,
        installments: input.installments ?? 1,
        description: input.feature ? `Realwise Premium - ${input.feature}` : 'Realwise Premium',
        payer: {
          ...(input.payer ?? {}),
          email,
        },
        notification_url: `${apiBaseUrl}/webhooks/mercadopago`,
        metadata: {
          clientId: input.clientId ?? '',
          name: input.name ?? '',
          whatsapp: input.whatsapp ?? '',
          couponCode: input.couponCode?.trim().toUpperCase() ?? '',
          feature: input.feature ?? '',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const payment = response.data;
    if (payment?.status === 'approved') {
      await this.handleMercadoPagoPaymentApproved(payment);
    }

    return {
      status: payment?.status,
      status_detail: payment?.status_detail ?? null,
      pix_code: payment?.point_of_interaction?.transaction_data?.qr_code ?? null,
      pix_qr_base64: payment?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      pending_doc_id: payment?.id ? String(payment.id) : null,
    };
  }

  constructStripeEvent(rawBody: Buffer, signature: string) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) {
      throw new BadRequestException('Stripe webhook is not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    const stripe = new Stripe(secretKey);
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  async handleStripeCheckoutCompleted(session: StripeCheckoutSessionLike) {
    const email = session.customer_details?.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Stripe checkout session did not include a customer email');
    }

    const metadata = session.metadata ?? {};
    const result = await this.entitlements.unlockPremiumAccess({
      clientId: metadata.clientId,
      email,
      name: metadata.name ?? null,
      amount: session.amount_total != null ? session.amount_total / 100 : null,
      paymentProvider: 'stripe',
      providerPaymentId: String(session.id),
      metadata: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent ?? null,
      },
    });
    if (!result.alreadyProcessed) {
      await this.incrementCouponUse(metadata.couponCode);
    }
    return result;
  }

  async fetchMercadoPagoPayment(paymentId: string) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new BadRequestException('Mercado Pago access token is not configured');
    }

    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }

  async handleMercadoPagoPaymentApproved(payment: MercadoPagoPaymentLike) {
    const email = payment.payer?.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Mercado Pago payment did not include a payer email');
    }

    const metadata = payment.metadata ?? {};
    const result = await this.entitlements.unlockPremiumAccess({
      clientId: metadata.clientId,
      email,
      name: metadata.name ?? null,
      amount: payment.transaction_amount ?? null,
      paymentProvider: 'mercadopago',
      providerPaymentId: String(payment.id),
      metadata: {
        mercadoPagoPaymentId: String(payment.id),
        mercadoPagoStatus: payment.status ?? null,
      },
    });
    if (!result.alreadyProcessed) {
      await this.incrementCouponUse(metadata.couponCode);
    }
    return result;
  }
}
