import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseInterFaturaPdf, detectInterFaturaPdf } from '../bankParsers/interFaturaPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/inter-fatura.txt', 'utf8');

describe('inter fatura PDF parser', () => {
  it('detects Inter fatura by header markers', () => {
    expect(detectInterFaturaPdf(text)).toBe(true);
  });

  it('parses regular charges as expense', () => {
    const txs = parseInterFaturaPdf(text);
    const shopping = txs.find(t => t.description.includes('SHOPPING INTER'));
    expect(shopping).toBeDefined();
    expect(shopping.type).toBe('expense');
    expect(shopping.amount).toBe(283.90);
  });

  it('parses + R$ amounts as income (refund/credit)', () => {
    const txs = parseInterFaturaPdf(text);
    const refund = txs.find(t => t.description.includes('PAGTO DEBITO AUTOMATICO'));
    expect(refund).toBeDefined();
    expect(refund.type).toBe('income');
    expect(refund.amount).toBe(374.95);
  });

  it('parses Portuguese month names', () => {
    const txs = parseInterFaturaPdf(text);
    const dec = txs.find(t => t.amount === 61.05);
    expect(dec.date).toMatch(/^2025-12-12/);
  });

  it('preserves installment marker in description', () => {
    const txs = parseInterFaturaPdf(text);
    const installment = txs.find(t => t.description.includes('SHOPPING INTER'));
    expect(installment.description).toMatch(/Parcela 06 de 10/);
  });

  it('skips Total CARTAO summary rows', () => {
    const txs = parseInterFaturaPdf(text);
    expect(txs.find(t => t.description.startsWith('Total CART'))).toBeUndefined();
  });
});
