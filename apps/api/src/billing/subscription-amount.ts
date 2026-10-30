import type Stripe from 'stripe';
import type { StripeClient } from './stripe-client';

/**
 * What the subscriber really pays each billing interval, in centavos: the price times quantity, minus any coupon that
 * is still running. `null` when it cannot be known (an unexpanded discount), so callers fall back to the list price.
 */
export function netRecurringCents(subscription: Stripe.Subscription, now = Date.now()): number | null {
  let net = 0;
  let currency: string | null = null;
  for (const item of subscription.items.data) {
    net += (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
    currency = item.price.currency;
  }
  for (const discount of subscription.discounts ?? []) {
    if (typeof discount === 'string') return null;
    if (discount.end != null && discount.end * 1000 <= now) continue; // a repeating coupon that already ended
    const coupon = discount.coupon;
    if (coupon.percent_off) net *= 1 - coupon.percent_off / 100;
    else if (coupon.amount_off && (!currency || coupon.currency === currency)) net = Math.max(0, net - coupon.amount_off);
  }
  return Math.round(net);
}

/** Subscriptions come back with discounts as bare ids unless expanded; fetch them once when that is the case. */
export async function withDiscounts(stripe: StripeClient, subscription: Stripe.Subscription): Promise<Stripe.Subscription> {
  if (!subscription.discounts?.some((d) => typeof d === 'string')) return subscription;
  try {
    return await stripe.get().subscriptions.retrieve(subscription.id, { expand: ['discounts'] });
  } catch {
    return subscription;
  }
}
