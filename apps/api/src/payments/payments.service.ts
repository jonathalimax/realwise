import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Stripe from 'stripe';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { coupons, leads, pricingConfig, purchases } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';

type CouponRow = typeof coupons.$inferSelect;
type LeadRow = typeof leads.$inferSelect;
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  private get frontendBaseUrl() {
    return (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '');
  }

  private get stripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    return new Stripe(secretKey);
  }

  private normalizeClientId(clientId?: string | null) {
    const value = clientId?.trim();
    return value || 'app';
  }

  private normalizePlan(plan?: string | null) {
    const value = plan?.trim();
    return value || 'premium_access';
  }

  private async getPricingRow() {
    const rows = await this.db
      .select()
      .from(pricingConfig)
      .where(eq(pricingConfig.configKey, 'landing-pricing'))
      .orderBy(desc(pricingConfig.updatedAt));

    return rows[0] ?? {
      configKey: 'landing-pricing',
      basePriceCents: 23880,
      installments: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async findActiveCoupon(code?: string | null): Promise<CouponRow | null> {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) return null;

    const rows = await this.db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, normalized),
          eq(coupons.enabled, true),
          or(isNull(coupons.expiresAt), gt(coupons.expiresAt, new Date())),
        ),
      );

    const coupon = rows[0] ?? null;
    if (!coupon) {
      throw new BadRequestException('Cupom invalido ou expirado.');
    }

    if (coupon.maxUses !== null && coupon.useCount >= coupon.maxUses) {
      throw new BadRequestException('Esse cupom ja atingiu o limite de uso.');
    }

    return coupon;
  }

  private applyCoupon(basePriceCents: number, coupon: CouponRow | null) {
    if (!coupon) {
      return { finalPriceCents: basePriceCents, discountCents: 0 };
    }

    const rawDiscountValue = Number(coupon.discountValue ?? 0);
    const normalizedType = (coupon.discountType ?? '').toLowerCase();

    let finalPriceCents = basePriceCents;
    if (normalizedType === 'percent' || normalizedType === 'percentage') {
      finalPriceCents = Math.round(basePriceCents * (1 - rawDiscountValue / 100));
    } else if (normalizedType === 'fixed' || normalizedType === 'fixed_amount') {
      finalPriceCents = basePriceCents - Math.round(rawDiscountValue * 100);
    }

    finalPriceCents = Math.max(0, finalPriceCents);
    return {
      finalPriceCents,
      discountCents: Math.max(0, basePriceCents - finalPriceCents),
    };
  }

  private async upsertLead(dto: CreatePaymentSessionDto, clientId: string, plan: string) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim() || null;

    const existing = await this.db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .orderBy(desc(leads.createdAt));

    if (existing[0]) {
      const rows = await this.db
        .update(leads)
        .set({
          name,
          plan,
          status: 'checkout_started',
          metadata: {
            ...((existing[0].metadata as Record<string, unknown> | null) ?? {}),
            clientId,
          },
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing[0].id))
        .returning();

      return rows[0] as LeadRow;
    }

    const rows = await this.db
      .insert(leads)
      .values({
        email,
        name,
        plan,
        status: 'checkout_started',
        metadata: { clientId },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return rows[0] as LeadRow;
  }

  private buildSuccessUrl(clientId: string) {
    const url = new URL(`${this.frontendBaseUrl}/purchase-success`);
    url.searchParams.set('clientId', clientId);
    url.searchParams.set('premium', '1');
    url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    return url.toString();
  }

  private buildCancelUrl(clientId: string, dto: CreatePaymentSessionDto) {
    const url = new URL(`${this.frontendBaseUrl}/checkout`);
    url.searchParams.set('clientId', clientId);
    url.searchParams.set('premium', '1');
    url.searchParams.set('canceled', '1');
    url.searchParams.set('email', dto.email.trim().toLowerCase());
    if (dto.name?.trim()) url.searchParams.set('name', dto.name.trim());
    if (dto.couponCode?.trim()) url.searchParams.set('coupon', dto.couponCode.trim().toUpperCase());
    return url.toString();
  }

  async createCheckoutSession(dto: CreatePaymentSessionDto) {
    const clientId = this.normalizeClientId(dto.clientId);
    const plan = this.normalizePlan(dto.plan);
    const pricing = await this.getPricingRow();
    const coupon = await this.findActiveCoupon(dto.couponCode);
    const { finalPriceCents, discountCents } = this.applyCoupon(pricing.basePriceCents, coupon);
    const lead = await this.upsertLead(dto, clientId, plan);

    const stripePriceId = process.env.STRIPE_PRICE_ID?.trim() || null;
    const stripe = this.stripe;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      locale: 'pt-BR',
      customer_email: dto.email.trim().toLowerCase(),
      success_url: this.buildSuccessUrl(clientId),
      cancel_url: this.buildCancelUrl(clientId, dto),
      metadata: {
        leadId: lead.id,
        clientId,
        email: dto.email.trim().toLowerCase(),
        name: dto.name?.trim() || '',
        couponCode: coupon?.code ?? '',
        plan,
        basePriceCents: String(pricing.basePriceCents),
        finalPriceCents: String(finalPriceCents),
      },
      line_items: stripePriceId
        ? [{
            price: stripePriceId,
            quantity: 1,
          }]
        : [{
            price_data: {
              currency: 'brl',
              product_data: {
                name: 'Realwise Premium',
                description: 'Desbloqueio dos recursos premium do Realwise',
              },
              unit_amount: finalPriceCents,
            },
            quantity: 1,
          }],
    });

    await this.db.insert(purchases).values({
      clientId,
      email: dto.email.trim().toLowerCase(),
      plan,
      amount: (finalPriceCents / 100).toFixed(2),
      status: 'pending',
      paymentProvider: 'stripe',
      providerPaymentId: session.id,
      metadata: {
        leadId: lead.id,
        couponCode: coupon?.code ?? null,
        discountCents,
        stripeCheckoutUrl: session.url,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      url: session.url,
      sessionId: session.id,
      amountCents: finalPriceCents,
      installments: pricing.installments,
      couponCode: coupon?.code ?? null,
      discountCents,
    };
  }

  private async markCouponUsed(code?: string | null) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) return;

    const rows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, normalized));

    const coupon = rows[0];
    if (!coupon) return;

    await this.db
      .update(coupons)
      .set({
        useCount: coupon.useCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, coupon.id));
  }

  private async markPurchasePaid(session: Stripe.Checkout.Session) {
    const sessionId = session.id;
    const email = session.customer_details?.email?.trim().toLowerCase() || session.metadata?.email?.trim().toLowerCase();
    const plan = session.metadata?.plan || 'premium_access';
    const clientId = this.normalizeClientId(session.metadata?.clientId);
    const amountTotal = session.amount_total ?? 0;

    const purchaseRows = await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.providerPaymentId, sessionId))
      .orderBy(desc(purchases.createdAt));

    if (purchaseRows[0]) {
      await this.db
        .update(purchases)
        .set({
          email: email || purchaseRows[0].email,
          status: 'paid',
          amount: (amountTotal / 100).toFixed(2),
          updatedAt: new Date(),
          metadata: {
            ...((purchaseRows[0].metadata as Record<string, unknown> | null) ?? {}),
            stripePaymentStatus: session.payment_status,
          },
        })
        .where(eq(purchases.id, purchaseRows[0].id));
    } else if (email) {
      await this.db.insert(purchases).values({
        clientId,
        email,
        plan,
        amount: (amountTotal / 100).toFixed(2),
        status: 'paid',
        paymentProvider: 'stripe',
        providerPaymentId: sessionId,
        metadata: {
          stripePaymentStatus: session.payment_status,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (email) {
      const leadRows = await this.db
        .select()
        .from(leads)
        .where(eq(leads.email, email))
        .orderBy(desc(leads.createdAt));

      if (leadRows[0]) {
        await this.db
          .update(leads)
          .set({
            status: 'paid',
            plan,
            updatedAt: new Date(),
            metadata: {
              ...((leadRows[0].metadata as Record<string, unknown> | null) ?? {}),
              clientId,
              stripeSessionId: sessionId,
            },
          })
          .where(eq(leads.id, leadRows[0].id));
      }
    }

    await this.markCouponUsed(session.metadata?.couponCode);

    if (email) {
      await this.notifications.sendAdminEmail(email, 'welcome', {
        name: session.metadata?.name || email.split('@')[0],
      });
    }
  }

  async handleStripeWebhook(rawBody?: Buffer, signature?: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!rawBody || !signature || !webhookSecret) {
      throw new BadRequestException('Stripe webhook is not configured correctly');
    }

    const stripe = this.stripe;
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      await this.markPurchasePaid(event.data.object as Stripe.Checkout.Session);
    } else {
      this.logger.debug(`Ignoring Stripe webhook event ${event.type}`);
    }

    return { received: true };
  }
}
