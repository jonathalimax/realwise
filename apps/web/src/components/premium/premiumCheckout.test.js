import { describe, expect, it } from 'vitest';
import {
  buildPremiumCheckoutPayload,
  getPaymentMethodOptions,
  validatePremiumCheckoutContact,
} from './premiumCheckout';

describe('premiumCheckout', () => {
  it('offers wallet and mercadopago payment methods with the expected providers', () => {
    expect(getPaymentMethodOptions().map((option) => ({
      id: option.id,
      provider: option.provider,
    }))).toEqual([
      { id: 'apple_pay', provider: 'stripe' },
      { id: 'google_pay', provider: 'stripe' },
      { id: 'pix', provider: 'mercadopago' },
      { id: 'card', provider: 'mercadopago' },
    ]);
  });

  it('requires contact fields before starting checkout', () => {
    expect(validatePremiumCheckoutContact({
      name: '',
      email: 'wrong',
      whatsapp: '',
      coupon: ' vip45 ',
    })).toEqual({
      ok: false,
      error: 'Preencha nome, e-mail e WhatsApp para continuar.',
    });
  });

  it('normalizes the premium checkout payload for Stripe and Mercado Pago', () => {
    expect(buildPremiumCheckoutPayload({
      form: {
        name: '  Jane Doe  ',
        email: '  JANE@EXAMPLE.COM ',
        whatsapp: ' (41) 99999-1234 ',
        coupon: ' vip45 ',
      },
      clientId: 'jonathalimax',
      utmSource: 'premium-lock',
    })).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      whatsapp: '(41) 99999-1234',
      couponCode: 'VIP45',
      clientId: 'jonathalimax',
      utmSource: 'premium-lock',
    });
  });
});
