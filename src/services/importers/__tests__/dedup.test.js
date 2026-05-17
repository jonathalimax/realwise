import { describe, test, expect } from 'vitest';
import { generateTransactionHash } from '../../installments';

describe('generateTransactionHash — stable dedup', () => {
  const base = { date: '2026-05-01', amount: -374.95, bankType: 'inter', originalId: 'TXN-001', positionalIndex: 0 };

  test('same inputs always produce the same hash', () => {
    expect(generateTransactionHash(base)).toBe(generateTransactionHash(base));
  });
  test('different description produces the same hash (description excluded)', () => {
    const a = { ...base, description: 'PIX JOAO SILVA' };
    const b = { ...base, description: 'PIX J SILVA 05/04' };
    expect(generateTransactionHash(a)).toBe(generateTransactionHash(b));
  });
  test('different type produces the same hash (type excluded)', () => {
    expect(generateTransactionHash({ ...base, type: 'income' })).toBe(generateTransactionHash({ ...base, type: 'expense' }));
  });
  test('negative and positive amounts produce the same hash', () => {
    expect(generateTransactionHash({ ...base, amount: 374.95 })).toBe(generateTransactionHash({ ...base, amount: -374.95 }));
  });
  test('different originalId produces different hash', () => {
    expect(generateTransactionHash({ ...base, originalId: 'TXN-001' })).not.toBe(generateTransactionHash({ ...base, originalId: 'TXN-002' }));
  });
  test('different positionalIndex produces different hash when no originalId', () => {
    expect(generateTransactionHash({ ...base, originalId: '', positionalIndex: 0 })).not.toBe(generateTransactionHash({ ...base, originalId: '', positionalIndex: 1 }));
  });
  test('cross-bank collision: different bankType produces different hash', () => {
    expect(generateTransactionHash({ ...base, bankType: 'nubank' })).not.toBe(generateTransactionHash({ ...base, bankType: 'bradesco' }));
  });
  test('hash is a 64-char hex string', () => {
    expect(generateTransactionHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
