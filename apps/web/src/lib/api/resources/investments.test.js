import { describe, expect, it, vi } from 'vitest';
import { createInvestmentsResource, normalizeInvestment } from './investments';

describe('normalizeInvestment', () => {
  it('normalizes persisted numeric fields', () => {
    expect(
      normalizeInvestment({
        id: 'inv-1',
        initialAmount: '1000.00',
        currentAmount: '1200.50',
        expectedReturn: '0.125',
        totalWithdrawn: '50.00',
      })
    ).toEqual({
      id: 'inv-1',
      initialAmount: 1000,
      currentAmount: 1200.5,
      expectedReturn: 0.125,
      quantity: 0,
      avgPrice: 0,
      currentPrice: 0,
      totalWithdrawn: 50,
    });
  });
});

describe('createInvestmentsResource', () => {
  it('normalizes rows returned from list', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([
        { id: 'inv-1', initialAmount: '100.00', currentAmount: '150.00', expectedReturn: '0.05' },
      ]),
    };

    const resource = createInvestmentsResource({ client });

    await expect(resource.list()).resolves.toEqual([
      { id: 'inv-1', initialAmount: 100, currentAmount: 150, expectedReturn: 0.05, quantity: 0, avgPrice: 0, currentPrice: 0, totalWithdrawn: 0 },
    ]);
  });
});
