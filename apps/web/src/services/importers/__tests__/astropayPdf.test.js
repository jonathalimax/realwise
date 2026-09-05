import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseAstroPayPdf, detectAstroPayPdf } from '../bankParsers/astropayPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/astropay-extrato.txt', 'utf8');
const itauText = fs.readFileSync('src/services/importers/__tests__/fixtures/itau-extrato.txt', 'utf8');
const multiMonthText = fs.readFileSync(
  'src/services/importers/__tests__/fixtures/astropay-extrato-multimonth.txt',
  'utf8'
);

describe('astropay PDF parser', () => {
  it('parses all real transaction rows', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    expect(txs.length).toBe(5);
  });

  it('skips Saldo Inicial and Saldo Final rows', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    expect(txs.find(t => /Saldo Inicial/i.test(t.description))).toBeUndefined();
    expect(txs.find(t => /Saldo Final/i.test(t.description))).toBeUndefined();
  });

  it('maps negative amounts to expense and positive amounts to income', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    const pix = txs.find(t => /Pix enviado/i.test(t.description));
    expect(pix.type).toBe('expense');
    expect(pix.amount).toBe(150);

    const cashback = txs.find(t => /Cashback/i.test(t.description));
    expect(cashback.type).toBe('income');
    expect(cashback.amount).toBe(25.5);
  });

  it('explicitly categorizes cashback rows as Investimentos, leaving other rows uncategorized', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    const cashback = txs.find(t => /Cashback/i.test(t.description));
    expect(cashback.category).toBe('Investimentos');

    const pix = txs.find(t => /Pix enviado/i.test(t.description));
    expect(pix.category).toBeUndefined();

    const fx = txs.find(t => /Câmbio de moeda/i.test(t.description));
    expect(fx.category).toBeUndefined();

    const internal = txs.find(t => /INTERNAL_COMPENSATION/i.test(t.description));
    expect(internal.category).toBeUndefined();
  });

  it('parses FX conversion and internal compensation rows as normal transactions', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    const fx = txs.find(t => /Câmbio de moeda/i.test(t.description));
    expect(fx).toBeDefined();
    expect(fx.type).toBe('expense');
    expect(fx.amount).toBe(500);

    const internal = txs.find(t => /INTERNAL_COMPENSATION/i.test(t.description));
    expect(internal).toBeDefined();
    expect(internal.type).toBe('income');
    expect(internal.amount).toBe(200);
  });

  it('resolves MM/DD dates correctly, including day 31 (not misread as a month)', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    const dayThirtyOne = txs.find(t => /Assinatura streaming/i.test(t.description));
    expect(dayThirtyOne).toBeDefined();
    const date = new Date(dayThirtyOne.date);
    expect(date.getUTCFullYear() || date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August (0-indexed)
    expect(date.getDate()).toBe(31);
  });

  it('anchors dates at noon local time so ISO conversion never shifts the calendar day', () => {
    const { transactions: txs } = parseAstroPayPdf(text);
    const pix = txs.find(t => /Pix enviado/i.test(t.description));
    expect(pix).toBeDefined();
    expect(new Date(pix.date).getHours()).toBe(12);
  });

  it('reports skippedCount as 0 when every row matches the statement period', () => {
    const { skippedCount } = parseAstroPayPdf(text);
    expect(skippedCount).toBe(0);
  });

  it('parses rows from both months when the statement period spans two calendar months', () => {
    const { transactions: txs } = parseAstroPayPdf(multiMonthText);
    expect(txs.length).toBe(3);

    const july29 = txs.find(t => /Cashback/i.test(t.description));
    expect(july29).toBeDefined();
    const julyDate = new Date(july29.date);
    expect(julyDate.getFullYear()).toBe(2026);
    expect(julyDate.getMonth()).toBe(6); // July (0-indexed)
    expect(julyDate.getDate()).toBe(29);

    const july31 = txs.find(t => /Pix enviado/i.test(t.description));
    expect(july31).toBeDefined();
    const julyPixDate = new Date(july31.date);
    expect(julyPixDate.getMonth()).toBe(6); // July
    expect(julyPixDate.getDate()).toBe(31);

    const aug05 = txs.find(t => /Câmbio de moeda/i.test(t.description));
    expect(aug05).toBeDefined();
    const augDate = new Date(aug05.date);
    expect(augDate.getFullYear()).toBe(2026);
    expect(augDate.getMonth()).toBe(7); // August (0-indexed)
    expect(augDate.getDate()).toBe(5);
  });

  it('detects AstroPay statements', () => {
    expect(detectAstroPayPdf(text)).toBe(true);
  });

  it('does not detect other bank fixtures as AstroPay', () => {
    expect(detectAstroPayPdf(itauText)).toBe(false);
  });
});
