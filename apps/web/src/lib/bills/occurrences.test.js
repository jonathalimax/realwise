import { describe, expect, it } from 'vitest';
import { buildMonthlyBillRows, getBillSeriesKey } from './occurrences';

describe('bill occurrences', () => {
  it('creates one preview row for a recurring bill when no concrete occurrence exists', () => {
    const rows = buildMonthlyBillRows([
      {
        id: 'bill-1',
        name: 'Rent',
        amount: '1500.00',
        dueDate: '2026-06-10T12:00:00.000Z',
        status: 'pending',
        recurrence: 'monthly',
      },
    ], '2026-08');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'bill-1',
      dueDate: '2026-08-10T00:00:00.000Z',
      isRecurringInstance: true,
      isPreviewOccurrence: true,
    });
  });

  it('prefers the concrete occurrence over a preview for the same recurring month', () => {
    const rows = buildMonthlyBillRows([
      {
        id: 'bill-1',
        name: 'Rent',
        amount: '1500.00',
        dueDate: '2026-06-10T12:00:00.000Z',
        status: 'paid',
        recurrence: 'monthly',
      },
      {
        id: 'bill-2',
        name: 'Rent',
        amount: '1500.00',
        dueDate: '2026-08-10T00:00:00.000Z',
        status: 'pending',
        recurrence: 'monthly',
        seriesId: 'bill-1',
      },
    ], '2026-08');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'bill-2',
      dueDate: '2026-08-10T00:00:00.000Z',
      isRecurringInstance: false,
      isPreviewOccurrence: false,
    });
  });

  it('derives a stable legacy series key when seriesId is missing', () => {
    expect(getBillSeriesKey({
      id: 'bill-1',
      name: 'Internet',
      amount: '120.00',
      recurrence: 'monthly',
      category: 'utilities',
      linkedBankId: 'bank-1',
    })).toMatch(/^legacy:/);
  });
});
