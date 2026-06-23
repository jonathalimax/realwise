import { describe, it, expect } from 'vitest';
import fs from 'fs';
import Papa from 'papaparse';
import { parseBradescoStatement, detectBradesco } from '../bankParsers/bradesco';

function loadCsv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const headerIdx = raw.indexOf('Data;');
  const trimmed = raw.substring(headerIdx);
  const { data } = Papa.parse(trimmed, { header: true, skipEmptyLines: true, delimiter: ';' });
  return data;
}

describe('bradesco CSV parser', () => {
  const data = loadCsv('src/services/importers/__tests__/fixtures/bradesco-conta.csv');

  it('detects Bradesco by real headers including (R$) suffix', () => {
    expect(detectBradesco(Object.keys(data[0]))).toBe(true);
  });

  it('parses credit transactions as income', () => {
    const txs = parseBradescoStatement(data);
    const credit = txs.find(t => t.description.includes('TRANSFERENCIA PIX') && t.amount === 571.27);
    expect(credit).toBeDefined();
    expect(credit.type).toBe('income');
    expect(credit.date).toMatch(/^2026-03-02/);
  });

  it('parses debit transactions as expense', () => {
    const txs = parseBradescoStatement(data);
    const debit = txs.find(t => t.amount === 1711.98);
    expect(debit).toBeDefined();
    expect(debit.type).toBe('expense');
  });

  it('skips footer "Últimos Lancamentos" header row and total row', () => {
    const txs = parseBradescoStatement(data);
    expect(txs.find(t => t.description === 'Histórico')).toBeUndefined();
    expect(txs.find(t => t.description === 'Total')).toBeUndefined();
  });

  it('returns at least 100 transactions from the real fixture', () => {
    const txs = parseBradescoStatement(data);
    expect(txs.length).toBeGreaterThan(100);
  });
});
