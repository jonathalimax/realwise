import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseMercadoPagoPdf } from '../bankParsers/mercadopagoPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/mercadopago-fatura.txt', 'utf8');

describe('mercadopago PDF parser', () => {
  it('returns at least one transaction (not the previous stub)', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs.length).toBeGreaterThan(0);
  });

  it('marks all transactions as expense (credit card bill)', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs.every(t => t.type === 'expense')).toBe(true);
  });

  it('infers year from "Vence em" line if dates lack year', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs[0].date).toMatch(/^2026-/);
  });
});
