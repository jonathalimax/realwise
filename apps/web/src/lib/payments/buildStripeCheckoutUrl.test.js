import { describe, it, expect } from 'vitest';
import { buildStripeCheckoutUrl } from './buildStripeCheckoutUrl';

describe('buildStripeCheckoutUrl', () => {
  it('returns null when base url is missing', () => {
    expect(buildStripeCheckoutUrl('')).toBeNull();
  });

  it('adds pt-BR locale and prefilled email', () => {
    const result = buildStripeCheckoutUrl('https://buy.stripe.com/test_123', {
      email: '  User@Example.com ',
    });

    expect(result).toBe('https://buy.stripe.com/test_123?locale=pt-BR&prefilled_email=user%40example.com');
  });

  it('preserves existing params and appends coupon and reference name', () => {
    const result = buildStripeCheckoutUrl('https://buy.stripe.com/test_123?foo=bar', {
      email: 'user@example.com',
      name: 'Jonatha Lima',
      coupon: ' premium45 ',
    });

    expect(result).toBe('https://buy.stripe.com/test_123?foo=bar&locale=pt-BR&prefilled_email=user%40example.com&prefilled_promo_code=PREMIUM45&client_reference_id=Jonatha+Lima');
  });
});
