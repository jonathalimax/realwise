import axios from 'axios';
import { MercadoPagoClient } from './mercadopago.client';

jest.mock('axios');

describe('MercadoPagoClient', () => {
  it('sends an idempotency key when creating a payment', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'mp-1' } });
    (axios.create as jest.Mock).mockReturnValue({ post, get: jest.fn() });

    const client = new MercadoPagoClient();

    await expect(client.createPayment({
      transaction_amount: 1992,
      installments: 1,
      payment_method_id: 'pix',
      email: 'buyer@example.com',
    })).resolves.toEqual({ id: 'mp-1' });

    expect(post).toHaveBeenCalledWith(
      '/v1/payments',
      expect.objectContaining({
        transaction_amount: 19.92,
        payment_method_id: 'pix',
        payer: expect.objectContaining({ email: 'buyer@example.com' }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Idempotency-Key': expect.any(String),
        }),
      }),
    );
  });
});
