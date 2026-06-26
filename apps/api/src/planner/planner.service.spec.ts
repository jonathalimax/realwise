import { Test } from '@nestjs/testing';
import { PlannerService } from './planner.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockRow = { id: 'plan-1', clientId: 'jonathalimax', userId: 'user-1', salaryGross: '8000.00', deductions: {}, allocations: {}, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
};

describe('PlannerService', () => {
  let service: PlannerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PlannerService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(PlannerService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.onConflictDoUpdate.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
  });

  it('get returns current planner or null', async () => {
    expect(await service.get('jonathalimax', 'user-1')).toEqual(mockRow);
  });

  it('get returns null when no planner exists', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    expect(await service.get('jonathalimax', 'user-1')).toBeNull();
  });

  it('upsert returns updated row', async () => {
    expect(await service.upsert({ salaryGross: '8000.00' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
