import { Test } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'goal-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Emergency Fund', targetAmount: '10000.00', currentAmount: '2500.00', deadline: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('GoalsService', () => {
  let service: GoalsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GoalsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(GoalsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('findAll returns goals', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    expect(await service.create({ name: 'Emergency Fund', targetAmount: '10000.00' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
