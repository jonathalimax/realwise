import { Test } from '@nestjs/testing';
import { UserSettingsService } from './user-settings.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockRow = { id: 'set-1', clientId: 'jonathalimax', userId: 'user-1', currency: 'BRL', language: 'pt-BR', darkMode: false, billReminders: true, monthlyRollover: true, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
};

describe('UserSettingsService', () => {
  let service: UserSettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserSettingsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(UserSettingsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.onConflictDoUpdate.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
  });

  it('get returns settings', async () => {
    expect(await service.get('jonathalimax', 'user-1')).toEqual(mockRow);
  });

  it('get returns null when no settings exist', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    expect(await service.get('jonathalimax', 'user-1')).toBeNull();
  });

  it('upsert returns updated settings', async () => {
    expect(await service.upsert({ currency: 'USD' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
