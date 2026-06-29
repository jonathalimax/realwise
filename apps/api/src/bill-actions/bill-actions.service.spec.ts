import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillActionsService } from './bill-actions.service';
import { DRIZZLE } from '../db/drizzle.module';
import { BillsService } from '../bills/bills.service';

const now = new Date('2026-06-29T12:00:00.000Z');

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

const mockBill = {
  id: 'bill-1',
  clientId: 'client-1',
  userId: 'user-1',
  name: 'Rent',
  amount: '1500.00',
  dueDate: '2026-07-10',
  status: 'pending',
  recurrence: 'monthly',
  recurrenceEndDate: null,
  category: 'Housing',
  categoryId: null,
  linkedBankId: null,
};

const mockBillsService = {
  findOne: jest.fn().mockResolvedValue(mockBill),
  markPaid: jest.fn().mockResolvedValue({ ...mockBill, status: 'paid' }),
};

describe('BillActionsService', () => {
  let service: BillActionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillActionsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: BillsService, useValue: mockBillsService },
      ],
    }).compile();

    service = module.get(BillActionsService);
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a token without consuming it', async () => {
    mockDb.returning.mockResolvedValueOnce([{
      id: 'token-1',
      billId: 'bill-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-07-01T12:00:00.000Z'),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    }]);

    const result = await service.createTokenForBill(mockBill, { tokenTtlHours: 48 });

    expect(result.expiresAt).toEqual(new Date('2026-07-01T12:00:00.000Z'));
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      billId: 'bill-1',
      clientId: 'client-1',
      userId: 'user-1',
      usedAt: null,
    }));
  });

  it('rejects an expired token when resolving a session', async () => {
    mockDb.where.mockResolvedValueOnce([{
      id: 'token-1',
      billId: 'bill-1',
      clientId: 'client-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-06-28T12:00:00.000Z'),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    }]);

    await expect(service.getSession('deadbeef')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirms payment and marks the token used', async () => {
    mockDb.where.mockResolvedValueOnce([{
      id: 'token-1',
      billId: 'bill-1',
      clientId: 'client-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-07-01T12:00:00.000Z'),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    }]);
    mockDb.returning.mockResolvedValueOnce([{ ...mockBill, status: 'paid' }]);

    const result = await service.confirmPayment('live-token', { paidAmount: '1490.00' });

    expect(mockBillsService.markPaid).toHaveBeenCalledWith('bill-1', expect.objectContaining({
      targetDueDate: '2026-07-10',
      paidAmount: '1490.00',
    }), 'client-1', 'user-1');
    expect(result.status).toBe('paid');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('rejects already used tokens', async () => {
    mockDb.where.mockResolvedValueOnce([{
      id: 'token-1',
      billId: 'bill-1',
      clientId: 'client-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date('2026-07-01T12:00:00.000Z'),
      usedAt: new Date('2026-06-29T12:00:00.000Z'),
      createdAt: now,
      updatedAt: now,
    }]);

    mockBillsService.findOne.mockResolvedValueOnce(mockBill);

    await expect(service.confirmPayment('already-used', { paidAmount: '1490.00' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
