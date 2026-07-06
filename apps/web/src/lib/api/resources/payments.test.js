import { describe, expect, it, vi } from 'vitest';
import { createPaymentsResource } from './payments';

describe('createPaymentsResource', () => {
  it('starts Stripe hosted checkout through the API', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
    };

    const resource = createPaymentsResource({ client });
    const result = await resource.createStripeCheckout({ email: 'buyer@example.com' });

    expect(client.post).toHaveBeenCalledWith('/payments/stripe/checkout', { email: 'buyer@example.com' });
    expect(result).toEqual({ url: 'https://checkout.stripe.com/test' });
  });

  it('loads Mercado Pago quote details through the API', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ publicKey: 'TEST', amount: 238.8 }),
    };

    const resource = createPaymentsResource({ client });
    const result = await resource.createMercadoPagoQuote({ email: 'buyer@example.com' });

    expect(client.post).toHaveBeenCalledWith('/payments/mercadopago/quote', { email: 'buyer@example.com' });
    expect(result).toEqual({ publicKey: 'TEST', amount: 238.8 });
  });

  it('submits Mercado Pago payment data through the API', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ status: 'approved' }),
    };

    const resource = createPaymentsResource({ client });
    const payload = { email: 'buyer@example.com', transaction_amount: 238.8 };
    const result = await resource.processMercadoPagoPayment(payload);

    expect(client.post).toHaveBeenCalledWith('/payments/mercadopago/process', payload);
    expect(result).toEqual({ status: 'approved' });
  });

  it('saves partial lead data through the compatibility API route', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ ok: true }),
    };

    const resource = createPaymentsResource({ client });
    const payload = { email: 'buyer@example.com', whatsapp: '5511999999999' };
    const result = await resource.savePartialLead(payload);

    expect(client.post).toHaveBeenCalledWith('/payments/partial-lead', payload);
    expect(result).toEqual({ ok: true });
  });
});
