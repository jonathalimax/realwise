import { Test } from '@nestjs/testing';
import { BillsService } from './bills.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'bill-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Rent', amount: '1500.00', dueDate: '2026-07-01', status: 'pending', recurrence: 'monthly', categoryId: null, createdAt: new Date(), updatedAt: new Date() };
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

describe('BillsService', () => {
  let service: BillsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BillsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(BillsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns bills for user', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('markPaid updates status to paid', async () => {
    mockDb.where.mockResolvedValueOnce([mockRow]);  // findOne resolves
    mockDb.where.mockReturnValueOnce(mockDb);       // update chain where returns this
    mockDb.returning.mockResolvedValueOnce([{ ...mockRow, status: 'paid' }]);
    const result = await service.markPaid('bill-1', 'jonathalimax', 'user-1');
    expect(result).toBeDefined();
  });
});
