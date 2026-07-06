import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;

  const mockAdminService = {
    getPricingConfig: jest.fn(),
    updatePricingConfig: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('returns the premium pricing configuration shape', async () => {
    mockAdminService.getPricingConfig.mockResolvedValue({
      configKey: 'landing-pricing',
      basePriceCents: 23880,
      compareAtPriceCents: 47988,
      installments: 12,
      stripeWalletEnabled: true,
      mercadopagoEnabled: true,
    });

    await expect(controller.getPricingConfig()).resolves.toEqual({
      configKey: 'landing-pricing',
      basePriceCents: 23880,
      compareAtPriceCents: 47988,
      installments: 12,
      stripeWalletEnabled: true,
      mercadopagoEnabled: true,
    });
  });

  it('passes premium offer fields through to updatePricingConfig', async () => {
    mockAdminService.updatePricingConfig.mockResolvedValue({
      configKey: 'landing-pricing',
      basePriceCents: 19900,
      compareAtPriceCents: 39900,
      installments: 6,
      stripeWalletEnabled: false,
      mercadopagoEnabled: true,
    });

    const patch = {
      basePriceCents: 19900,
      compareAtPriceCents: 39900,
      installments: 6,
      stripeWalletEnabled: false,
      mercadopagoEnabled: true,
    };

    await expect(controller.updatePricingConfig(patch)).resolves.toEqual({
      configKey: 'landing-pricing',
      basePriceCents: 19900,
      compareAtPriceCents: 39900,
      installments: 6,
      stripeWalletEnabled: false,
      mercadopagoEnabled: true,
    });
    expect(mockAdminService.updatePricingConfig).toHaveBeenCalledWith(patch);
  });
});
