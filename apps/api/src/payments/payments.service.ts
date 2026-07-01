import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { coupons, leads, pricingConfig, purchases } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { CreatePartialLeadDto } from './dto/create-partial-lead.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { MercadoPagoClient } from './mercadopago.client';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

type CouponRow = typeof coupons.$inferSelect;
type PricingRow = typeof pricingConfig.$inferSelect;
type PurchaseRow = typeof purchases.$inferSelect;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
    private readonly mercadoPago: MercadoPagoClient,
  ) {}

  async createSession(dto: CreatePaymentSessionDto): Promise<{
    publicKey: string;
    amount: number;
    couponCode: string | null;
    installments: number;
  }> {
    const pricing = await this.getPricing();
    const coupon = await this.resolveCoupon(dto.couponCode);
    const amount = this.applyCoupon(pricing.basePriceCents, coupon);

    return {
      publicKey: process.env.MP_PUBLIC_KEY ?? '',
      amount,
      couponCode: coupon?.code ?? null,
      installments: pricing.installments,
    };
  }

  async processPayment(dto: ProcessPaymentDto): Promise<Record<string, unknown>> {
    const pricing = await this.getPricing();
    const coupon = await this.resolveCoupon(dto.couponCode);
    const expectedAmount = this.applyCoupon(pricing.basePriceCents, coupon);

    if (Math.round(dto.transaction_amount) !== expectedAmount) {
      throw new BadRequestException('Valor do pagamento não confere.');
    }

    if (expectedAmount === 0) {
      const inserted = await this.db
        .insert(purchases)
        .values({
          clientId: 'app',
          email: dto.email,
          plan: 'lifetime',
          amount: '0.00',
          status: 'approved',
          paymentProvider: 'free',
          metadata: {
            couponCode: coupon?.code ?? null,
            welcomeEmailSentAt: nowIso(),
          },
        })
        .returning();

      if (coupon) {
        await this.incrementCouponUsage(coupon);
      }

      await this.upsertLead(dto);
      await this.notifications.sendAdminEmail(dto.email, 'welcome', { name: dto.name || 'Cliente' });

      return {
        status: 'approved',
        pending_doc_id: inserted[0]?.id,
      };
    }

    const providerPayment = await this.mercadoPago.createPayment(dto);
    const providerId = String(providerPayment.id ?? '');
    const status = String(providerPayment.status ?? 'pending');
    const statusDetail = String(providerPayment.status_detail ?? '');
    const txData = (providerPayment.point_of_interaction as Record<string, unknown> | undefined)?.transaction_data as Record<string, unknown> | undefined;

    const inserted = await this.db
      .insert(purchases)
      .values({
        clientId: 'app',
        email: dto.email,
        plan: 'lifetime',
        amount: centsToAmount(expectedAmount),
        status,
        paymentProvider: 'mercadopago',
        providerPaymentId: providerId,
        metadata: {
          couponCode: coupon?.code ?? null,
          name: dto.name ?? null,
          whatsapp: dto.whatsapp ?? null,
          welcomeEmailSentAt: null,
        },
      })
      .returning();

    await this.upsertLead(dto);

    if (status === 'approved') {
      if (coupon) {
        await this.incrementCouponUsage(coupon);
      }
      await this.notifications.sendAdminEmail(dto.email, 'welcome', { name: dto.name || 'Cliente' });
    }

    return {
      status,
      status_detail: statusDetail || undefined,
      pix_code: typeof txData?.qr_code === 'string' ? txData.qr_code : undefined,
      pix_qr_base64: typeof txData?.qr_code_base64 === 'string' ? txData.qr_code_base64 : undefined,
      pending_doc_id: inserted[0]?.id,
    };
  }

  async handleWebhook(dto: PaymentWebhookDto): Promise<{ ok: true; status: string }> {
    const paymentId = dto.paymentId || dto.dataId;
    if (!paymentId) {
      throw new BadRequestException('paymentId is required');
    }

    const payment = await this.mercadoPago.getPayment(paymentId);
    const status = String(payment.status ?? 'unknown');

    const purchaseRows = await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.providerPaymentId, paymentId));

    const purchase = purchaseRows[0] as PurchaseRow | undefined;
    if (!purchase) {
      return { ok: true, status };
    }

    const metadata = (purchase.metadata as Record<string, unknown> | null) ?? {};
    const welcomeEmailSentAt = metadata.welcomeEmailSentAt;
    const couponCode = typeof metadata.couponCode === 'string' ? metadata.couponCode : null;
    const payer = (payment.additional_info as Record<string, unknown> | undefined)?.payer as Record<string, unknown> | undefined;
    const buyerName = typeof payer?.first_name === 'string' ? payer.first_name : 'Cliente';

    await this.db
      .update(purchases)
      .set({
        status,
        metadata: {
          ...metadata,
          statusDetail: payment.status_detail ?? null,
          welcomeEmailSentAt: status === 'approved' && !welcomeEmailSentAt ? nowIso() : welcomeEmailSentAt,
        },
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, purchase.id));

    if (status === 'approved' && !welcomeEmailSentAt) {
      if (couponCode) {
        const couponRows = await this.db
          .select()
          .from(coupons)
          .where(eq(coupons.code, couponCode));
        const coupon = couponRows[0] as CouponRow | undefined;
        if (coupon) {
          await this.incrementCouponUsage(coupon);
        }
      }
      await this.notifications.sendAdminEmail(purchase.email, 'welcome', { name: buyerName });
    }

    return { ok: true, status };
  }

  async savePartialLead(dto: CreatePartialLeadDto): Promise<{ ok: true }> {
    const existingRows = await this.db
      .select()
      .from(leads)
      .where(eq(leads.email, dto.email));

    const existing = existingRows[0] as { id: string; metadata?: Record<string, unknown> | null } | undefined;
    if (existing) {
      await this.db
        .update(leads)
        .set({
          name: dto.name ?? null,
          status: 'partial_checkout',
          metadata: {
            ...(existing.metadata ?? {}),
            whatsapp: dto.whatsapp ?? null,
            utmSource: dto.utmSource ?? null,
          },
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id));
      return { ok: true };
    }

    await this.db
      .insert(leads)
      .values({
        email: dto.email,
        name: dto.name ?? null,
        plan: 'lifetime',
        status: 'partial_checkout',
        metadata: {
          whatsapp: dto.whatsapp ?? null,
          utmSource: dto.utmSource ?? null,
        },
      })
      .returning();

    return { ok: true };
  }

  private async getPricing(): Promise<PricingRow> {
    const pricingRows = await this.db
      .select()
      .from(pricingConfig)
      .where(eq(pricingConfig.configKey, 'landing-pricing'));

    return (pricingRows[0] as PricingRow | undefined) ?? {
      configKey: 'landing-pricing',
      basePriceCents: 23880,
      installments: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async resolveCoupon(rawCoupon?: string): Promise<CouponRow | null> {
    const normalizedCoupon = rawCoupon?.trim().toUpperCase();
    if (!normalizedCoupon) return null;

    const couponRows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, normalizedCoupon));

    const coupon = couponRows[0] as CouponRow | undefined;
    if (!coupon) {
      throw new BadRequestException('Cupom não encontrado.');
    }
    if (!coupon.enabled) {
      throw new BadRequestException('Cupom desabilitado.');
    }
    if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.useCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom atingiu o limite de usos.');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Cupom expirado.');
    }

    return coupon;
  }

  private applyCoupon(basePriceCents: number, coupon: CouponRow | null): number {
    if (!coupon) return basePriceCents;
    if (coupon.discountType === 'percentage') {
      return Math.max(0, Math.round(basePriceCents * (1 - Number(coupon.discountValue ?? '0') / 100)));
    }
    if (coupon.discountType === 'fixed_amount') {
      return Math.max(0, basePriceCents - Math.round(Number(coupon.discountValue ?? '0') * 100));
    }
    return basePriceCents;
  }

  private async incrementCouponUsage(coupon: CouponRow): Promise<void> {
    await this.db
      .update(coupons)
      .set({
        useCount: coupon.useCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, coupon.id));
  }

  private async upsertLead(dto: { email: string; name?: string; whatsapp?: string; couponCode?: string }): Promise<void> {
    await this.db
      .insert(leads)
      .values({
        email: dto.email,
        name: dto.name ?? null,
        plan: 'lifetime',
        status: 'checkout_started',
        metadata: {
          whatsapp: dto.whatsapp ?? null,
          couponCode: dto.couponCode?.trim().toUpperCase() || null,
        },
      })
      .returning();
  }
}

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function nowIso(): string {
  return new Date().toISOString();
}
