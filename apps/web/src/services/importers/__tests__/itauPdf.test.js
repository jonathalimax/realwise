import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseItauPdf } from '../bankParsers/itauPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/itau-extrato.txt', 'utf8');

describe('itau PDF parser', () => {
  it('parses transactions and skips SALDO DO DIA rows', () => {
    const txs = parseItauPdf(text);
    expect(txs.length).toBeGreaterThan(0);
    expect(txs.find(t => t.description === 'SALDO DO DIA')).toBeUndefined();
  });

  it('detects sign: positive value = income, negative = expense', () => {
    const txs = parseItauPdf(text);
    const expense = txs.find(t => t.description.includes('DA NIO FIBRA'));
    expect(expense.type).toBe('expense');
    const income = txs.find(t => t.description.includes('REND PAGO APLIC'));
    expect(income.type).toBe('income');
  });

  it('handles BR amount format with thousands separator', () => {
    const txs = parseItauPdf(text);
    const big = txs.find(t => t.amount === 15000);
    expect(big).toBeDefined();
  });
});
