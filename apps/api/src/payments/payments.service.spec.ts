import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../db/drizzle.module';
import { PaymentsService } from './payments.service';

const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(PaymentsService);
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

  it('stores partial leads through the compatibility endpoint', async () => {
    await expect(service.savePartialLead({
      email: 'buyer@example.com',
      name: 'Buyer Example',
      whatsapp: '5511999999999',
      utmSource: 'instagram',
    })).resolves.toEqual({ ok: true });

    expect(mockDb.insert).toHaveBeenCalled();
  });
});
