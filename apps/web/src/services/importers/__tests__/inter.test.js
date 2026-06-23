import { describe, it, expect } from 'vitest';
import fs from 'fs';
import Papa from 'papaparse';
import { parseInterStatement, detectInter } from '../bankParsers/inter';

function loadCsv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const headerIdx = raw.indexOf('Data Lançamento');
  const { data } = Papa.parse(raw.substring(headerIdx), { header: true, skipEmptyLines: true, delimiter: ';' });
  return data;
}

describe('inter CSV parser', () => {
  const data = loadCsv('src/services/importers/__tests__/fixtures/inter-conta.csv');

  it('detects Inter by 5-column header', () => {
    expect(detectInter(Object.keys(data[0]))).toBe(true);
  });

  it('parses negative values as expenses', () => {
    const txs = parseInterStatement(data);
    const fatura = txs.find(t => t.amount === 374.95);
    expect(fatura.type).toBe('expense');
  });

  it('parses positive values as income', () => {
    const txs = parseInterStatement(data);
    const pix = txs.find(t => t.amount === 373.78);
    expect(pix.type).toBe('income');
  });

  it('combines Histórico + Descrição into description', () => {
    const txs = parseInterStatement(data);
    const fatura = txs.find(t => t.amount === 374.95);
    expect(fatura.description).toMatch(/Pagamento efetuado/);
    expect(fatura.description).toMatch(/Pagamento Fatura/);
  });
});
