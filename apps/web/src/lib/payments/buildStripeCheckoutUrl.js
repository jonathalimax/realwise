export function buildStripeCheckoutUrl(baseUrl, { email = '', name = '', coupon = '' } = {}) {
  if (!baseUrl) {
    return null;
  }

  const url = new URL(baseUrl);
  url.searchParams.set('locale', 'pt-BR');

  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) {
    url.searchParams.set('prefilled_email', trimmedEmail);
  }

  const trimmedCoupon = coupon.trim().toUpperCase();
  if (trimmedCoupon) {
    url.searchParams.set('prefilled_promo_code', trimmedCoupon);
  }

  const trimmedName = name.trim();
  if (trimmedName) {
    url.searchParams.set('client_reference_id', trimmedName);
  }

  return url.toString();
}
