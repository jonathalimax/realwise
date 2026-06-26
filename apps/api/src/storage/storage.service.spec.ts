import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { DRIZZLE } from '../db/drizzle.module';
import { ConfigService } from '@nestjs/config';

const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{ id: 'att-1', objectKey: 'jonathalimax/user-1/import-1/file.csv' }]),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([{ id: 'att-1', objectKey: 'jonathalimax/user-1/import-1/file.csv', userId: 'user-1' }]),
};

const mockConfig = {
  get: (key: string) => {
    const map: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'realwise-attachments',
      MINIO_USE_SSL: 'false',
    };
    return map[key];
  },
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(StorageService);
  });

  it('buildKey produces scoped path', () => {
    const key = service.buildKey('jonathalimax', 'user-1', 'import-1', 'file.csv');
    expect(key).toBe('jonathalimax/user-1/import-1/file.csv');
  });

  it('recordAttachment inserts and returns attachment', async () => {
    const att = await service.recordAttachment({
      clientId: 'jonathalimax',
      userId: 'user-1',
      importId: 'import-1',
      objectKey: 'jonathalimax/user-1/import-1/file.csv',
      mimeType: 'text/csv',
      sizeBytes: 1024,
    });
    expect(att.id).toBe('att-1');
  });
});
