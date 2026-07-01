import { Test } from '@nestjs/testing';
import { ImportsService } from './imports.service';
import { DRIZZLE } from '../db/drizzle.module';
import { BankParserService } from './bank-parser.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockImportRow = {
  id: 'imp-1', clientId: 'jonathalimax', userId: 'user-1', bank: 'nubank',
  status: 'review', rowCount: 2, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null,
};

const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockImportRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockImportRow]),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
};

const mockParser = {
  parse: jest.fn().mockReturnValue({
    bank: 'nubank',
    transactions: [
      { date: '2026-06-01', amount: '150.00', type: 'expense', description: 'Supermercado' },
      { date: '2026-06-02', amount: '39.90', type: 'expense', description: 'Netflix' },
    ],
  }),
};

const mockNotifications = {
  sendImportIssueEmail: jest.fn(),
};

describe('ImportsService', () => {
  let service: ImportsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: BankParserService, useValue: mockParser },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(ImportsService);
    jest.clearAllMocks();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockImportRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([mockImportRow]);
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockNotifications.sendImportIssueEmail.mockResolvedValue(undefined);
  });

  it('processUpload creates import record and returns parsed transactions', async () => {
    const csv = Buffer.from('date,title,amount\n2026-06-01,Supermercado,-150.00');
    const result = await service.processUpload(csv, 'nubank.csv', 'jonathalimax', 'user-1');
    expect(result.importId).toBe('imp-1');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
  });

  it('confirm inserts transactions and marks import complete', async () => {
    await expect(
      service.confirm('imp-1', [
        { date: '2026-06-01', amount: '150.00', type: 'expense', description: 'Supermercado', categoryId: undefined, accountId: undefined },
      ], 'jonathalimax', 'user-1'),
    ).resolves.not.toThrow();
  });

  it('reportIssue stores the issue and sends a notification email', async () => {
    const result = await service.reportIssue({
      fileName: 'extrato.csv',
      fileMime: 'text/csv',
      fileBase64: 'ZmFrZQ==',
      bankType: 'nubank',
      parserUsed: 'csv-parser',
      detectedHeaders: ['date', 'description', 'amount'],
      errorMessage: 'Unknown format',
      userNote: 'Arquivo exportado pelo app',
      userName: 'Jonatha',
      userEmail: 'jonatha@example.com',
    }, 'jonathalimax', 'user-1');

    expect(result).toEqual({ ok: true, issueId: 'imp-1' });
    expect(mockNotifications.sendImportIssueEmail).toHaveBeenCalledWith({
      issueId: 'imp-1',
      clientId: 'jonathalimax',
      userId: 'user-1',
      fileName: 'extrato.csv',
      fileMime: 'text/csv',
      bankType: 'nubank',
      parserUsed: 'csv-parser',
      errorMessage: 'Unknown format',
      userNote: 'Arquivo exportado pelo app',
      userName: 'Jonatha',
      userEmail: 'jonatha@example.com',
    });
  });
});
