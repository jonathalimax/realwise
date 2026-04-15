import { describe, it, expect } from 'vitest';
import { resolveDeduction, computeDeductionTotal, computeNetSalary } from './rendaCalc.js';

describe('resolveDeduction', () => {
  it('returns fixed value for type "value"', () => {
    expect(resolveDeduction(10000, { type: 'value', amount: 300 })).toBe(300);
  });

  it('returns percentage of salarioBruto for type "pct"', () => {
    expect(resolveDeduction(10000, { type: 'pct', amount: 6 })).toBe(600);
  });

  it('handles 0% deduction', () => {
    expect(resolveDeduction(10000, { type: 'pct', amount: 0 })).toBe(0);
  });

  it('handles 0 fixed deduction', () => {
    expect(resolveDeduction(10000, { type: 'value', amount: 0 })).toBe(0);
  });
});

describe('computeDeductionTotal', () => {
  it('returns 0 for empty deductions array', () => {
    expect(computeDeductionTotal(10000, [])).toBe(0);
  });

  it('sums multiple value deductions', () => {
    const deductions = [
      { type: 'value', amount: 300 },
      { type: 'value', amount: 150 },
      { type: 'value', amount: 50 },
    ];
    expect(computeDeductionTotal(10000, deductions)).toBe(500);
  });

  it('sums multiple pct deductions', () => {
    const deductions = [
      { type: 'pct', amount: 10 },
      { type: 'pct', amount: 5 },
    ];
    // 10% + 5% of 10000 = 1500
    expect(computeDeductionTotal(10000, deductions)).toBe(1500);
  });

  it('mixes pct and value deductions', () => {
    const deductions = [
      { type: 'pct', amount: 6 },   // 600
      { type: 'value', amount: 300 }, // 300
      { type: 'value', amount: 150 }, // 150
    ];
    expect(computeDeductionTotal(10000, deductions)).toBe(1050);
  });

  it('scales pct deductions proportionally with salary', () => {
    const deductions = [{ type: 'pct', amount: 10 }];
    expect(computeDeductionTotal(5000, deductions)).toBe(500);
    expect(computeDeductionTotal(20000, deductions)).toBe(2000);
  });
});

describe('computeNetSalary', () => {
  it('returns salarioBruto unchanged when no deductions', () => {
    expect(computeNetSalary(10000, [])).toBe(10000);
  });

  it('subtracts a single fixed deduction', () => {
    expect(computeNetSalary(10000, [{ type: 'value', amount: 500 }])).toBe(9500);
  });

  it('subtracts a percentage deduction', () => {
    expect(computeNetSalary(10000, [{ type: 'pct', amount: 10 }])).toBe(9000);
  });

  it('subtracts mixed deductions (simulates PJ scenario)', () => {
    // simplesNacional 6% + planoSaude 300 + contabilidade 150 + internet 50
    const deductions = [
      { id: 'simples', label: 'Simples Nacional', type: 'pct', amount: 6 },
      { id: 'saude', label: 'Plano de Saúde', type: 'value', amount: 300 },
      { id: 'contabil', label: 'Contabilidade', type: 'value', amount: 150 },
      { id: 'internet', label: 'Internet', type: 'value', amount: 50 },
    ];
    // 10000 - 600 - 300 - 150 - 50 = 8900
    expect(computeNetSalary(10000, deductions)).toBe(8900);
  });

  it('returns 0 when deductions equal salary', () => {
    expect(computeNetSalary(1000, [{ type: 'value', amount: 1000 }])).toBe(0);
  });

  it('can return negative if deductions exceed salary', () => {
    expect(computeNetSalary(1000, [{ type: 'value', amount: 1500 }])).toBe(-500);
  });
});
