// Inter credit-card bill (fatura) PDF text format.
// Parses transaction rows with Portuguese long-form dates ("DD de MMM. YYYY"),
// + R$ prefix indicates income (refund/credit), bare R$ is expense (charge).
// Skips card-section headers ("CARTAO XXX****YYYY") and totals ("Total CARTAO ...").

const MONTHS_PT = {
  'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
  'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
};

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s+]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseLongDate(str) {
  // "02 de abr. 2026" -> ISO
  const m = str.trim().toLowerCase().match(/^(\d{1,2})\s+de\s+(\w{3})\.?\s+(\d{4})$/);
  if (!m) return null;
  const [, d, monAbbr, y] = m;
  const monthIdx = MONTHS_PT[monAbbr];
  if (monthIdx == null) return null;
  return new Date(parseInt(y), monthIdx, parseInt(d)).toISOString();
}

// Match a row: DATE DESCRIPTION [- or BENEFICIARY] [+ ]R$ AMOUNT
// Greedy on description until we see the trailing amount.
const ROW_RE = /(\d{1,2}\s+de\s+\w{3}\.?\s+\d{4})\s+(.+?)\s+(?:-\s+)?(\+?\s*R\$\s*[\d.]+,\d{2})/gi;

export function parseInterFaturaPdf(text) {
  const flat = text.replace(/\s+/g, ' ');
  const out = [];
  ROW_RE.lastIndex = 0;
  let m;
  while ((m = ROW_RE.exec(flat)) !== null) {
    const [, dateStr, descRaw, amountStr] = m;
    const description = descRaw.trim().replace(/\s+/g, ' ');
    if (/^Total\s+CART/i.test(description)) continue;
    if (/^CART[^\s]*\s+\d/i.test(description)) continue;
    const date = parseLongDate(dateStr);
    if (!date) continue;
    const isIncome = /^\+/.test(amountStr.trim());
    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    out.push({
      date,
      amount: Math.abs(amount),
      type: isIncome ? 'income' : 'expense',
      description,
      originalId: '',
    });
  }
  return out;
}

export function detectInterFaturaPdf(text) {
  return /Despesas da fatura/i.test(text)
    && /CART[^\s]*\s+\d{4}/i.test(text);
}
