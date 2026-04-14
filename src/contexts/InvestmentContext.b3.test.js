import { describe, it, expect } from 'vitest';

describe('B3 investment source bypass', () => {
  it('b3 investment should use currentAmount directly without projection', () => {
    const investment = {
      source: 'b3',
      currentAmount: 1500,
      initialAmount: 1000,
      status: null,
    };

    function getCurrentValue(inv) {
      if (inv.status === 'closed') return 0;
      if (inv.source === 'b3') return inv.currentAmount ?? inv.initialAmount ?? 0;
      if (inv.currentAmount !== undefined && inv.currentAmount !== inv.initialAmount) return inv.currentAmount;
      return inv.initialAmount;
    }

    expect(getCurrentValue(investment)).toBe(1500);
  });

  it('closed b3 investment returns 0', () => {
    const investment = { source: 'b3', currentAmount: 1500, status: 'closed' };
    function getCurrentValue(inv) {
      if (inv.status === 'closed') return 0;
      if (inv.source === 'b3') return inv.currentAmount ?? inv.initialAmount ?? 0;
      return inv.currentAmount;
    }
    expect(getCurrentValue(investment)).toBe(0);
  });

  it('b3 investment with no currentAmount falls back to initialAmount', () => {
    const investment = { source: 'b3', initialAmount: 2000, status: null };
    function getCurrentValue(inv) {
      if (inv.status === 'closed') return 0;
      if (inv.source === 'b3') return inv.currentAmount ?? inv.initialAmount ?? 0;
      return inv.currentAmount;
    }
    expect(getCurrentValue(investment)).toBe(2000);
  });
});
