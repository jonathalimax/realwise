import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseOfx } from '../bankParsers/ofx';

describe('ofx parser', () => {
  const raw = fs.readFileSync('src/services/importers/__tests__/fixtures/inter-conta.ofx', 'utf8');

  it('parses transactions from real Inter OFX', () => {
    const txs = parseOfx(raw);
    expect(txs.length).toBeGreaterThan(0);
  });

  it('returns ISO dates from YYYYMMDD format', () => {
    const txs = parseOfx(raw);
    expect(txs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses positive amount + type from sign', () => {
    const txs = parseOfx(raw);
    for (const t of txs) {
      expect(t.amount).toBeGreaterThan(0);
      expect(['income', 'expense']).toContain(t.type);
    }
  });
});
