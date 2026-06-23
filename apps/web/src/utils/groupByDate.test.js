import { describe, it, expect } from 'vitest';
import { groupByDate } from './groupByDate';

describe('groupByDate', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDate([])).toEqual([]);
  });

  it('groups transactions sharing a date into one entry', () => {
    const txs = [
      { _localId: '1', date: '2025-05-12T10:00:00.000Z' },
      { _localId: '2', date: '2025-05-12T18:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-05-12');
    expect(result[0].transactions).toHaveLength(2);
  });

  it('creates a separate group for each distinct date', () => {
    const txs = [
      { _localId: '1', date: '2025-05-12T10:00:00.000Z' },
      { _localId: '2', date: '2025-05-11T09:00:00.000Z' },
      { _localId: '3', date: '2025-05-10T08:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result.map(g => g.date)).toEqual(['2025-05-12', '2025-05-11', '2025-05-10']);
  });

  it('preserves order within each group', () => {
    const txs = [
      { _localId: 'a', date: '2025-05-12T10:00:00.000Z' },
      { _localId: 'b', date: '2025-05-12T18:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result[0].transactions.map(t => t._localId)).toEqual(['a', 'b']);
  });

  it('handles transactions with no T separator in date string', () => {
    const txs = [{ _localId: '1', date: '2025-05-12' }];
    const result = groupByDate(txs);
    expect(result[0].date).toBe('2025-05-12');
  });
});
