import { Test } from '@nestjs/testing';
import axios from 'axios';
import { DRIZZLE } from '../db/drizzle.module';
import { PaymentsService } from './payments.service';
import { PremiumEntitlementsService } from './premium-entitlements.service';

jest.mock('axios');

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000101',
  clientId: 'jonathalimax',
  email: 'buyer@example.com',
  name: 'Buyer Example',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  profileImageUrl: null,
  refreshTokenHash: null,
  premiumAccessStartedAt: new Date('2026-07-02T12:00:00.000Z'),
  premiumAccessEndsAt: new Date('2026-08-16T12:00:00.000Z'),
  premiumPurchasedAt: null,
  premiumStatus: 'trialing' as const,
  premiumPaymentProvider: null,
  premiumProviderPaymentId: null,
  createdAt: new Date('2026-07-02T12:00:00.000Z'),
  updatedAt: new Date('2026-07-02T12:00:00.000Z'),
};

const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

const mockEntitlements = {
  unlockPremiumAccess: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-public-key';
    delete process.env.MP_PUBLIC_KEY;

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PremiumEntitlementsService, useValue: mockEntitlements },
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(PaymentsService);
    mockEntitlements.unlockPremiumAccess.mockResolvedValue({
      user: fakeUser,
      purchase: { id: 'purchase-1' },
      alreadyProcessed: false,
    });
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('activates premium from a Stripe checkout session and records the provider payment id', async () => {
    await service.handleStripeCheckoutCompleted({
      id: 'cs_test_123',
      payment_intent: 'pi_123',
      amount_total: 23900,
      customer_details: { email: 'buyer@example.com' },
      metadata: {
        clientId: 'jonathalimax',
        name: 'Buyer Example',
      },
    });

    expect(mockEntitlements.unlockPremiumAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'jonathalimax',
        email: 'buyer@example.com',
        name: 'Buyer Example',
        paymentProvider: 'stripe',
        providerPaymentId: 'cs_test_123',
      }),
    );
  });

  it('activates premium from an approved Mercado Pago payment', async () => {
    await service.handleMercadoPagoPaymentApproved({
      id: 998877,
      status: 'approved',
      transaction_amount: 239,
      payer: { email: 'buyer@example.com' },
      metadata: {
        clientId: 'jonathalimax',
        name: 'Buyer Example',
      },
    });

    expect(mockEntitlements.unlockPremiumAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'jonathalimax',
        email: 'buyer@example.com',
        name: 'Buyer Example',
        paymentProvider: 'mercadopago',
        providerPaymentId: '998877',
      }),
    );
  });

  it('builds a Mercado Pago quote from pricing config and a percentage coupon', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            configKey: 'landing-pricing',
            basePriceCents: 23880,
            compareAtPriceCents: 47988,
            installments: 12,
            stripeWalletEnabled: true,
            mercadopagoEnabled: true,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            code: 'VIP45',
            discountType: 'percentage',
            discountValue: '45',
            maxUses: 100,
            useCount: 0,
            enabled: true,
            expiresAt: null,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    await expect(service.createMercadoPagoQuote({
      email: 'buyer@example.com',
      couponCode: 'vip45',
    })).resolves.toEqual({
      publicKey: 'TEST-public-key',
      amount: 131.34,
      baseAmount: 238.8,
      couponCode: 'VIP45',
      installments: 12,
    });
  });

  it('supports the legacy session endpoint wrapper', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            configKey: 'landing-pricing',
            basePriceCents: 23880,
            compareAtPriceCents: 47988,
            installments: 12,
            stripeWalletEnabled: true,
            mercadopagoEnabled: true,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    const result = await service.createSession({
      email: 'buyer@example.com',
      name: 'Buyer Example',
      whatsapp: '5511999999999',
      couponCode: undefined,
      utmSource: 'instagram',
    });

    expect(result).toEqual({
      publicKey: 'TEST-public-key',
      amount: 238.8,
      baseAmount: 238.8,
      couponCode: null,
      installments: 12,
    });
  });

  it('converts cents for the legacy process endpoint wrapper', async () => {
    process.env.MP_ACCESS_TOKEN = 'test-access-token';
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          configKey: 'landing-pricing',
          basePriceCents: 23880,
          compareAtPriceCents: 47988,
          installments: 12,
          stripeWalletEnabled: true,
          mercadopagoEnabled: true,
        }]),
      }),
    });

    jest.mocked(axios.post).mockResolvedValue({
      data: {
        id: 12345,
        status: 'pending',
        status_detail: null,
        point_of_interaction: { transaction_data: {} },
      },
    } as any);

    await service.processPayment({
      transaction_amount: 23880,
      installments: 1,
      email: 'buyer@example.com',
      name: 'Buyer Example',
      whatsapp: '5511999999999',
      couponCode: undefined,
      payer: {},
    });

    expect(jest.mocked(axios.post)).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/payments',
      expect.objectContaining({
        transaction_amount: 238.8,
      }),
      expect.any(Object),
    );
  });

  it('stores partial leads through the compatibility endpoint', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    await expect(service.savePartialLead({
      email: 'buyer@example.com',
      name: 'Buyer Example',
      whatsapp: '5511999999999',
      utmSource: 'instagram',
    })).resolves.toEqual({ ok: true });

    expect(mockDb.insert).toHaveBeenCalled();
  });
});
