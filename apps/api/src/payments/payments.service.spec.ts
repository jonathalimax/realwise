import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../db/drizzle.module';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from './payments.service';
import { PremiumEntitlementsService } from './premium-entitlements.service';

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

const mockAuthService = {
  findOrCreateUser: jest.fn(),
};

const mockNotificationsService = {
  sendAdminEmail: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PremiumEntitlementsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(PaymentsService);
    mockAuthService.findOrCreateUser.mockResolvedValue(fakeUser);
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
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{
          id: 'purchase-1',
          clientId: 'jonathalimax',
          email: 'buyer@example.com',
          status: 'approved',
          paymentProvider: 'stripe',
          providerPaymentId: 'cs_test_123',
        }]),
      }),
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

    expect(mockAuthService.findOrCreateUser).toHaveBeenCalledWith({
      clientId: 'jonathalimax',
      email: 'buyer@example.com',
      name: 'Buyer Example',
    });
    expect(mockNotificationsService.sendAdminEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      'access_granted',
      expect.objectContaining({ name: 'Buyer Example' }),
    );
  });

  it('derives the client id from the email when Stripe metadata does not include one', async () => {
    await service.handleStripeCheckoutCompleted({
      id: 'cs_test_derive',
      payment_intent: 'pi_derive',
      amount_total: 23900,
      customer_details: { email: 'jonathalimax@gmail.com' },
      metadata: {
        name: 'Jonatha Lima',
      },
    });

    expect(mockAuthService.findOrCreateUser).toHaveBeenCalledWith({
      clientId: 'jonathalimax',
      email: 'jonathalimax@gmail.com',
      name: 'Jonatha Lima',
    });
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

    expect(mockAuthService.findOrCreateUser).toHaveBeenCalledWith({
      clientId: 'jonathalimax',
      email: 'buyer@example.com',
      name: 'Buyer Example',
    });
  });

  it('does not duplicate purchases or resend access email when the same provider payment is retried', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          id: 'purchase-existing',
          clientId: 'jonathalimax',
          email: 'buyer@example.com',
          status: 'approved',
          paymentProvider: 'stripe',
          providerPaymentId: 'cs_test_123',
        }]),
      }),
    });

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

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockNotificationsService.sendAdminEmail).not.toHaveBeenCalled();
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
      });

    process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-public-key';

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

  it('refuses Stripe checkout when wallet payments are disabled in pricing config', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          configKey: 'landing-pricing',
          basePriceCents: 23880,
          compareAtPriceCents: 47988,
          installments: 12,
          stripeWalletEnabled: false,
          mercadopagoEnabled: true,
        }]),
      }),
    });

    await expect(service.createStripeCheckout({
      email: 'buyer@example.com',
    })).rejects.toThrow('Carteiras digitais estao desabilitadas no momento.');
  });
});
