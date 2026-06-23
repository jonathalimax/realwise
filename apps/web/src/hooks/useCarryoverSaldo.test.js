import { describe, it, expect } from 'vitest';
import { computeCarryoverSaldo } from './useCarryoverSaldo';

// Converts a date string to 'YYYY-MM' using transaction date (purchase mode)
const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

describe('computeCarryoverSaldo', () => {
  it('returns zero carryover when no transactions exist', () => {
    const result = computeCarryoverSaldo([], '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(0);
    expect(result.cumulativeByMonth).toEqual({});
  });

  it('returns zero when all transactions are in the selected month', () => {
    const txs = [
      { date: '2026-04-02', type: 'income', amount: 5000 },
      { date: '2026-04-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(0);
  });

  it('accumulates balance from all prior months', () => {
    const txs = [
      { date: '2026-01-02', type: 'income', amount: 5000 },
      { date: '2026-01-15', type: 'expense', amount: 4000 }, // Jan: +1000
      { date: '2026-02-02', type: 'income', amount: 5000 },
      { date: '2026-02-15', type: 'expense', amount: 4500 }, // Feb: +500, cumul: 1500
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(1500);
  });

  it('does not include the selected month in the carryover', () => {
    const txs = [
      { date: '2026-03-02', type: 'income', amount: 5000 },
      { date: '2026-03-15', type: 'expense', amount: 4000 }, // Mar: +1000
      { date: '2026-04-02', type: 'income', amount: 5000 }, // selected month — excluded
      { date: '2026-04-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(1000);
  });

  it('excludes ignored transactions', () => {
    const txs = [
      { date: '2026-01-02', type: 'income', amount: 5000, ignored: true },
      { date: '2026-01-15', type: 'expense', amount: 4000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(-4000);
  });

  it('handles negative carryover when spending exceeds income', () => {
    const txs = [
      { date: '2026-01-02', type: 'income', amount: 1000 },
      { date: '2026-01-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(-2000);
  });

  it('builds cumulativeByMonth with correct running totals', () => {
    const txs = [
      { date: '2026-01-02', type: 'income', amount: 5000 },
      { date: '2026-01-15', type: 'expense', amount: 4000 },
      { date: '2026-02-02', type: 'income', amount: 5000 },
      { date: '2026-02-15', type: 'expense', amount: 4500 },
      { date: '2026-03-02', type: 'income', amount: 5000 },
      { date: '2026-03-15', type: 'expense', amount: 4000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-05', 'purchase', dateKey);
    expect(result.cumulativeByMonth).toEqual({
      '2026-01': 1000,
      '2026-02': 1500,
      '2026-03': 2500,
    });
  });

  it('in payment mode uses getPaymentMonthKey for non-income expenses', () => {
    const paymentKeyFn = (_date, _bankId, _method) => '2026-03';
    const txs = [
      { date: '2026-01-01', type: 'expense', amount: 1000, bankId: 'bank1', paymentMethod: 'credit' },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'payment', paymentKeyFn);
    expect(result.cumulativeByMonth['2026-01']).toBeUndefined();
    expect(result.cumulativeByMonth['2026-03']).toBe(-1000);
    expect(result.carryoverSaldo).toBe(-1000);
  });

  it('in payment mode income always uses the transaction date regardless of getPaymentMonthKey', () => {
    const paymentKeyFn = () => '2026-99'; // should never be called for income
    const txs = [
      { date: '2026-01-02', type: 'income', amount: 5000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'payment', paymentKeyFn);
    expect(result.cumulativeByMonth['2026-01']).toBe(5000);
    expect(result.cumulativeByMonth['2026-99']).toBeUndefined();
  });
});
