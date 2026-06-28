import { describe, expect, it, vi } from 'vitest';
import { createBudgetsResource, normalizeBudget } from './budgets';

describe('normalizeBudget', () => {
  it('normalizes numeric fields for budget documents', () => {
    expect(
      normalizeBudget({
        id: 'budget-1',
        month: '2026-06',
        totalBudget: '4200.50',
        categoryBudgets: {
          Food: '300.25',
          Housing: 900,
        },
      })
    ).toEqual({
      id: 'budget-1',
      month: '2026-06',
      totalBudget: 4200.5,
      categoryBudgets: {
        Food: 300.25,
        Housing: 900,
      },
    });
  });
});

describe('createBudgetsResource', () => {
  it('filters legacy rows and normalizes budget rows', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([
        { id: 'legacy-1', name: 'Old budget', amount: '100.00' },
        {
          id: 'budget-1',
          month: '2026-06',
          totalBudget: '1200.00',
          categoryBudgets: { Food: '120.00' },
        },
      ]),
    };

    const resource = createBudgetsResource({ client });

    await expect(resource.list()).resolves.toEqual([
      {
        id: 'budget-1',
        month: '2026-06',
        totalBudget: 1200,
        categoryBudgets: { Food: 120 },
      },
    ]);
  });
});
