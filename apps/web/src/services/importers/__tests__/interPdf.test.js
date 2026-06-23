import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseInterPdf } from '../bankParsers/interPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/inter-extrato.txt', 'utf8');

describe('inter PDF parser', () => {
  it('parses transactions from real Inter PDF', () => {
    const txs = parseInterPdf(text);
    expect(txs.length).toBeGreaterThanOrEqual(5);
  });

  it('detects sign correctly (negative = expense)', () => {
    const txs = parseInterPdf(text);
    expect(txs.some((t) => t.type === 'expense')).toBe(true);
    expect(txs.some((t) => t.type === 'income')).toBe(true);
  });

  it('produces ISO dates', () => {
    const txs = parseInterPdf(text);
    for (const t of txs) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});
