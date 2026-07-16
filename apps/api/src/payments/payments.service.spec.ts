import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../db/drizzle.module';
import { PaymentsService } from './payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MercadoPagoClient } from './mercadopago.client';

const now = new Date('2026-06-30T12:00:00.000Z');

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

const mockNotifications = {
  sendAdminEmail: jest.fn(),
};

const mockMercadoPago = {
  createPayment: jest.fn(),
  getPayment: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    process.env.MP_PUBLIC_KEY = 'test-public-key';

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: MercadoPagoClient, useValue: mockMercadoPago },
      ],
    }).compile();

    service = module.get(PaymentsService);
    jest.useFakeTimers().setSystemTime(now);
    jest.resetAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockNotifications.sendAdminEmail.mockResolvedValue(undefined);
    mockMercadoPago.createPayment.mockResolvedValue(undefined);
    mockMercadoPago.getPayment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.MP_PUBLIC_KEY;
  });

  it('builds a payment session using pricing config and coupon rules', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ configKey: 'landing-pricing', basePriceCents: 23880, installments: 12 }])
      .mockResolvedValueOnce([{ code: 'SAVE10', discountType: 'percentage', discountValue: '10', maxUses: 10, useCount: 0, enabled: true, expiresAt: null }]);

    await expect(service.createSession({
      email: 'buyer@example.com',
      couponCode: 'save10',
      utmSource: 'instagram',
    })).resolves.toEqual({
      publicKey: 'test-public-key',
      amount: 21492,
      couponCode: 'SAVE10',
      installments: 12,
    });
  });

  it('rejects a disabled coupon during payment session bootstrap', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ configKey: 'landing-pricing', basePriceCents: 23880, installments: 12 }])
      .mockResolvedValueOnce([{ code: 'SAVE10', discountType: 'percentage', discountValue: '10', maxUses: 10, useCount: 0, enabled: false, expiresAt: null }]);

    await expect(service.createSession({
      email: 'buyer@example.com',
      couponCode: 'save10',
    })).rejects.toThrow('Cupom desabilitado.');
  });

  it('approves free checkout without calling Mercado Pago', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ configKey: 'landing-pricing', basePriceCents: 23880, installments: 12 }])
      .mockResolvedValueOnce([{ code: 'FREE100', discountType: 'percentage', discountValue: '100', maxUses: 1, useCount: 0, enabled: true, expiresAt: null }]);
    mockDb.returning.mockResolvedValueOnce([{ id: 'purchase-1' }]);

    await expect(service.processPayment({
      transaction_amount: 0,
      email: 'buyer@example.com',
      name: 'Buyer',
      couponCode: 'FREE100',
    })).resolves.toEqual({
      status: 'approved',
      pending_doc_id: 'purchase-1',
    });
    expect(mockMercadoPago.createPayment).not.toHaveBeenCalled();
    expect(mockNotifications.sendAdminEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      'welcome',
      expect.objectContaining({ name: 'Buyer' }),
    );
  });

  it('creates a pending Mercado Pago purchase and returns pix payload data', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ configKey: 'landing-pricing', basePriceCents: 23880, installments: 12 }])
      .mockResolvedValueOnce([]);
    mockMercadoPago.createPayment.mockResolvedValue({
      id: 'mp-1',
      status: 'pending',
      status_detail: 'pending_waiting_transfer',
      point_of_interaction: {
        transaction_data: {
          qr_code: 'pix-code',
          qr_code_base64: 'pix-base64',
        },
      },
    });
    mockDb.returning.mockResolvedValueOnce([{ id: 'purchase-2' }]);

    await expect(service.processPayment({
      transaction_amount: 23880,
      installments: 1,
      payment_method_id: 'pix',
      email: 'buyer@example.com',
      name: 'Buyer',
    })).resolves.toEqual({
      status: 'pending',
      status_detail: 'pending_waiting_transfer',
      pix_code: 'pix-code',
      pix_qr_base64: 'pix-base64',
      pending_doc_id: 'purchase-2',
    });
  });

  it('reconciles a webhook approval and increments coupon usage once', async () => {
    mockMercadoPago.getPayment.mockResolvedValue({
      id: 'mp-1',
      status: 'approved',
      status_detail: 'accredited',
      additional_info: {
        payer: { first_name: 'Buyer' },
      },
    });
    mockDb.where
      .mockResolvedValueOnce([{
        id: 'purchase-2',
        email: 'buyer@example.com',
        status: 'pending',
        providerPaymentId: 'mp-1',
        metadata: { couponCode: 'SAVE10', welcomeEmailSentAt: null },
      }])
      .mockResolvedValueOnce([{ id: 'purchase-2' }])
      .mockResolvedValueOnce([{ id: 'coupon-1', code: 'SAVE10', useCount: 0 }]);

    await expect(service.handleWebhook({
      paymentId: 'mp-1',
    })).resolves.toEqual({ ok: true, status: 'approved' });

    expect(mockNotifications.sendAdminEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      'welcome',
      expect.objectContaining({ name: 'Buyer' }),
    );
  });

  it('upserts a partial lead by email', async () => {
    mockDb.where
      .mockResolvedValueOnce([{
        id: 'lead-1',
        email: 'buyer@example.com',
        status: 'new',
        metadata: { utmSource: 'google' },
      }]);

    await expect(service.savePartialLead({
      email: 'buyer@example.com',
      whatsapp: '(41) 99999-1111',
      utmSource: 'instagram',
    })).resolves.toEqual({ ok: true });
  });
});
