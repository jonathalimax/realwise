import { describe, it, expect } from 'vitest';

function getTotalInvested(investments) {
  return investments.reduce((sum, inv) => {
    const net = (inv.initialAmount || 0) - (inv.totalWithdrawn || 0);
    return sum + Math.max(0, net);
  }, 0);
}

describe('getTotalInvested', () => {
  it('returns initialAmount when no withdrawal', () => {
    const investments = [{ initialAmount: 10000 }];
    expect(getTotalInvested(investments)).toBe(10000);
  });

  it('subtracts totalWithdrawn from initialAmount', () => {
    const investments = [{ initialAmount: 10000, totalWithdrawn: 3000 }];
    expect(getTotalInvested(investments)).toBe(7000);
  });

  it('never returns negative after a full withdrawal', () => {
    const investments = [{ initialAmount: 10000, totalWithdrawn: 10000 }];
    expect(getTotalInvested(investments)).toBe(0);
  });

  it('sums multiple investments correctly', () => {
    const investments = [
      { initialAmount: 10000, totalWithdrawn: 3000 },
      { initialAmount: 5000 },
      { initialAmount: 2000, totalWithdrawn: 2000 },
    ];

    expect(getTotalInvested(investments)).toBe(12000);
  });

  it('handles missing totalWithdrawn field', () => {
    const investments = [{ initialAmount: 8000 }];
    expect(getTotalInvested(investments)).toBe(8000);
  });
});
