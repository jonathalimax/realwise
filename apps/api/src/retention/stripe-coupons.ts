import type Stripe from 'stripe';

const codeOf = (e: unknown) => (typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined);

/** Returns the coupon id, creating the coupon in Stripe the first time (ids are deterministic, so this is idempotent). */
export async function ensureCoupon(
  stripe: Stripe,
  id: string,
  params: { name: string; percentOff: number; duration: 'once' | 'repeating'; months?: number },
): Promise<string> {
  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch (e) {
    if (codeOf(e) !== 'resource_missing') throw e;
  }
  try {
    await stripe.coupons.create({
      id,
      name: params.name,
      percent_off: params.percentOff,
      duration: params.duration,
      ...(params.duration === 'repeating' ? { duration_in_months: params.months } : {}),
    });
  } catch (e) {
    if (codeOf(e) !== 'resource_already_exists') throw e;
  }
  return id;
}
