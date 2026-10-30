import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type Stripe from 'stripe';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BillingService } from '../billing/billing.service';
import { StripeClient } from '../billing/stripe-client';

const CODE_RE = /^[A-Za-z0-9]{3,30}$/;
/** Smallest amount Stripe will charge in BRL, in centavos. */
const MIN_CHARGE_CENTS = 50;
const DURATIONS = ['once', 'forever', 'repeating'] as const;

const view = (p: Stripe.PromotionCode) => ({
  id: p.id,
  code: p.code,
  active: p.active && p.coupon.valid,
  timesRedeemed: p.times_redeemed,
  maxRedemptions: p.max_redemptions,
  expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
  percentOff: p.coupon.percent_off,
  amountOff: p.coupon.amount_off,
  currency: p.coupon.currency,
  duration: p.coupon.duration,
  durationInMonths: p.coupon.duration_in_months,
  createdAt: new Date(p.created * 1000).toISOString(),
});

/** Promotion codes live in Stripe (Checkout already accepts them); this is the admin's window onto them. */
@Controller('admin/coupons')
@UseGuards(AdminGuard)
export class AdminCouponsController {
  constructor(
    private readonly stripe: StripeClient,
    private readonly actor: AdminActorService,
    private readonly billing: BillingService,
  ) {}

  @Get()
  async list() {
    const res = await this.stripe.get().promotionCodes.list({ limit: 100, expand: ['data.coupon'] });
    return res.data.map(view);
  }

  @Post()
  async create(@CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    const code = String(body?.code ?? '').trim();
    if (!CODE_RE.test(code)) throw new BadRequestException('Código: 3 a 30 letras ou números, sem espaços.');
    const percent = Number(body?.percentOff);
    const amount = Number(body?.amountOffReais);
    const hasPercent = Number.isFinite(percent) && percent > 0;
    const hasAmount = Number.isFinite(amount) && amount > 0;
    if (hasPercent === hasAmount) throw new BadRequestException('Informe o desconto em % ou em R$ (apenas um).');
    if (hasPercent && percent > 100) throw new BadRequestException('O desconto não pode passar de 100%.');
    const duration = String(body?.duration ?? 'once') as (typeof DURATIONS)[number];
    if (!DURATIONS.includes(duration)) throw new BadRequestException('Duração inválida.');
    const months = Math.round(Number(body?.durationInMonths));
    if (duration === 'repeating' && !(months >= 1 && months <= 36)) throw new BadRequestException('Informe de 1 a 36 meses.');
    const maxRedemptions = body?.maxRedemptions ? Math.round(Number(body.maxRedemptions)) : undefined;
    if (maxRedemptions !== undefined && !(maxRedemptions >= 1)) throw new BadRequestException('Limite de usos inválido.');
    let expiresAt: number | undefined;
    if (body?.expiresAt) {
      const t = new Date(String(body.expiresAt)).getTime();
      if (!Number.isFinite(t) || t <= Date.now()) throw new BadRequestException('A validade precisa ser uma data futura.');
      expiresAt = Math.floor(t / 1000);
    }

    await this.assertChargeable(hasPercent ? { percent } : { amountOffCents: Math.round(amount * 100) });

    const stripe = this.stripe.get();
    const coupon = await stripe.coupons.create({
      ...(hasPercent ? { percent_off: percent } : { amount_off: Math.round(amount * 100), currency: 'brl' }),
      duration,
      ...(duration === 'repeating' ? { duration_in_months: months } : {}),
      name: code,
    });
    try {
      const promo = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        expand: ['coupon'],
      });
      await this.actor.record(admin, { action: 'coupon.create', targetLabel: code, details: { percent: hasPercent ? percent : null, amount: hasAmount ? amount : null, duration } });
      return view(promo);
    } catch (e) {
      await stripe.coupons.del(coupon.id).catch(() => undefined);
      throw new BadRequestException(e instanceof Error ? e.message : 'O Stripe recusou o código (talvez ele já exista).');
    }
  }

  /**
   * Stripe cannot charge less than about R$ 0,50. A discount that leaves a price between R$ 0,01 and that minimum
   * makes Checkout only validate the card and charge nothing (the subscription still starts), which looks like a
   * broken payment. Zero is fine (no charge needed); so is anything at or above the minimum.
   */
  private async assertChargeable(discount: { percent: number } | { amountOffCents: number }): Promise<void> {
    let plans: Awaited<ReturnType<BillingService['getPlans']>>;
    try {
      plans = await this.billing.getPlans();
    } catch {
      return; // prices unavailable: do not block the admin
    }
    for (const plan of plans) {
      const after = 'percent' in discount
        ? Math.round((plan.amount * (100 - discount.percent)) / 100)
        : Math.max(0, plan.amount - discount.amountOffCents);
      if (after > 0 && after < MIN_CHARGE_CENTS) {
        const label = plan.plan === 'annual' ? 'anual' : 'mensal';
        throw new BadRequestException(
          `Com esse desconto o plano ${label} custaria R$ ${(after / 100).toFixed(2).replace('.', ',')}, abaixo do mínimo que o Stripe cobra (R$ 0,50). O cartão seria só validado, sem cobrança. Use um desconto menor ou 100%.`,
        );
      }
    }
  }

  @Patch(':id')
  async setActive(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (!/^promo_[A-Za-z0-9]+$/.test(id)) throw new BadRequestException('Código inválido.');
    const active = body?.active === true;
    const promo = await this.stripe.get().promotionCodes.update(id, { active, expand: ['coupon'] });
    await this.actor.record(admin, { action: active ? 'coupon.enable' : 'coupon.disable', targetLabel: promo.code });
    return view(promo);
  }
}
