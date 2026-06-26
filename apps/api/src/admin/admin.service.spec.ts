import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockLead = { id: 'lead-1', email: 'test@example.com', name: 'Test', plan: 'basic', status: 'new', metadata: null, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null };
const mockCoupon = { id: 'coup-1', code: 'SAVE20', discountType: 'percent', discountValue: '20', maxUses: 100, useCount: 0, expiresAt: null, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockLead]),
  orderBy: jest.fn().mockResolvedValue([mockLead]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockCoupon]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(AdminService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockLead]); mockDb.orderBy.mockResolvedValue([mockLead]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockCoupon]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('listLeads returns leads ordered by createdAt', async () => {
    const result = await service.listLeads();
    expect(result).toEqual([mockLead]);
  });

  it('createCoupon inserts and returns coupon', async () => {
    const result = await service.createCoupon({ code: 'SAVE20', discountType: 'percent', discountValue: '20' });
    expect(result.code).toBe('SAVE20');
  });
});
