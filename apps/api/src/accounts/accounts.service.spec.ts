import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'uuid-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Nubank', type: 'credit', color: null, icon: null, balance: '0', createdAt: new Date(), updatedAt: new Date() };

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

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(AccountsService);
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

  it('findAll returns rows for the user', async () => {
    const result = await service.findAll('jonathalimax', 'user-1');
    expect(result).toEqual([mockRow]);
  });

  it('findOne returns row when found', async () => {
    const result = await service.findOne('uuid-1', 'jonathalimax', 'user-1');
    expect(result).toEqual(mockRow);
  });

  it('findOne throws NotFoundException when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('uuid-999', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    const result = await service.create({ name: 'Nubank', type: 'credit' }, 'jonathalimax', 'user-1');
    expect(result).toEqual(mockRow);
  });

  it('remove deletes the row', async () => {
    mockDb.where.mockResolvedValueOnce([mockRow]).mockResolvedValueOnce([]);
    await expect(service.remove('uuid-1', 'jonathalimax', 'user-1')).resolves.not.toThrow();
  });
});
