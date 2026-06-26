import { Test } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'inv-1', clientId: 'jonathalimax', userId: 'user-1', name: 'PETR4', ticker: 'PETR4', type: 'stock', quantity: '100', avgPrice: '35.50', currentPrice: '38.00', lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() };
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

describe('InvestmentsService', () => {
  let service: InvestmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [InvestmentsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(InvestmentsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('findAll returns investments', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    expect(await service.create({ name: 'PETR4', type: 'stock', ticker: 'PETR4' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
