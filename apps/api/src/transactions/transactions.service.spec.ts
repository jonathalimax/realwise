import { Test } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'tx-1', clientId: 'jonathalimax', userId: 'user-1', amount: '100.00', type: 'expense', date: '2026-06-15', description: 'Lunch', categoryId: null, accountId: null, createdAt: new Date(), updatedAt: new Date() };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TransactionsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(TransactionsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.offset.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns paged rows', async () => {
    const result = await service.findAll('jonathalimax', 'user-1', { month: '2026-06' });
    expect(result).toEqual([mockRow]);
  });

  it('findOne throws NotFoundException when not found', async () => {
    const mockDbSingle = { ...mockDb, where: jest.fn().mockResolvedValue([]) };
    const module2 = await Test.createTestingModule({
      providers: [TransactionsService, { provide: DRIZZLE, useValue: mockDbSingle }],
    }).compile();
    const svc2 = module2.get(TransactionsService);
    await expect(svc2.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    const result = await service.create(
      { amount: '100.00', type: 'expense', date: '2026-06-15' },
      'jonathalimax',
      'user-1',
    );
    expect(result).toEqual(mockRow);
  });

  it('normalizes numeric amounts before insert', async () => {
    await service.create(
      { amount: 126 as unknown as string, type: 'income', date: '2026-06-15' },
      'jonathalimax',
      'user-1',
    );

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '126.00',
      }),
    );
  });
});
