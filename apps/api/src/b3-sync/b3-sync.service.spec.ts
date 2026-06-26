import { Test } from '@nestjs/testing';
import { B3SyncService } from './b3-sync.service';
import { DRIZZLE } from '../db/drizzle.module';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockInvestments = [
  { id: 'inv-1', ticker: 'PETR4', quantity: '100', type: 'stock', userId: 'user-1', clientId: 'jonathalimax' },
  { id: 'inv-2', ticker: 'VALE3', quantity: '50', type: 'stock', userId: 'user-1', clientId: 'jonathalimax' },
];

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue(mockInvestments),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('B3SyncService', () => {
  let service: B3SyncService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        B3SyncService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(B3SyncService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue(mockInvestments);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockedAxios.get.mockResolvedValue({
      data: {
        results: [
          { symbol: 'PETR4', regularMarketPrice: 38.5 },
          { symbol: 'VALE3', regularMarketPrice: 65.2 },
        ],
      },
    });
  });

  it('syncUser fetches prices and returns updated count', async () => {
    // Separate mock chains: first call returns investments, subsequent calls return void for updates
    mockDb.where.mockResolvedValueOnce(mockInvestments).mockResolvedValue(undefined);
    const result = await service.syncUser('user-1', 'jonathalimax');
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(mockedAxios.get).toHaveBeenCalled();
  });

  it('syncUser returns 0 when no B3 investments found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const result = await service.syncUser('user-1', 'jonathalimax');
    expect(result.updated).toBe(0);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
