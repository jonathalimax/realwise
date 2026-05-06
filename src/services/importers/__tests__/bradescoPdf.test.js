import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseBradescoPdf } from '../bankParsers/bradescoPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/bradesco-conta.txt', 'utf8');

describe('bradesco PDF parser', () => {
  it('parses transactions from real fixture', () => {
    const txs = parseBradescoPdf(text);
    expect(txs.length).toBeGreaterThan(50);
  });

  it('preserves richer descriptions with payee names', () => {
    const txs = parseBradescoPdf(text);
    const pix = txs.find(t => t.description.includes('REM:'));
    expect(pix).toBeDefined();
  });

  it('skips "COD. LANC. 0" rows', () => {
    const txs = parseBradescoPdf(text);
    expect(txs.find(t => t.description === 'COD. LANC. 0')).toBeUndefined();
  });
});
