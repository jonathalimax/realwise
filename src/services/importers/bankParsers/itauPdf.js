// Itaú PF PDF text format (extracted via pdfjs):
//   "data lançamentos valor (R$) saldo (R$)" header
//   Repeated rows: DD/MM/YYYY <description tokens> <amount> [<balance>]
//   "SALDO DO DIA" rows are filler — skip them.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(dmy) {
  const [d, m, y] = dmy.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
}

// Matches a BR-format number (optionally negative, may have thousands sep)
const BR_AMOUNT_RE = /-?[\d.]+,\d{2}/g;
const DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
const DATE_SPLIT_RE = /(?=\d{2}\/\d{2}\/\d{4}\s)/g;

export function parseItauPdf(text) {
  // Normalise whitespace to single spaces
  const flat = text.replace(/\s+/g, ' ').trim();

  // Split into chunks starting at each date token
  const chunks = flat.split(DATE_SPLIT_RE).filter(c => DATE_RE.test(c));

  const out = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();

    // Extract leading date
    const dateMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})\s+/);
    if (!dateMatch) continue;
    const dmy = dateMatch[1];
    const rest = trimmed.slice(dateMatch[0].length);

    // Find all BR-format numbers in the rest
    const amounts = [...rest.matchAll(BR_AMOUNT_RE)];
    if (amounts.length === 0) continue;

    // The transaction amount is the FIRST number; remaining may be balance
    const amountStr = amounts[0][0];
    const amountStart = amounts[0].index;

    // Description is everything before the first amount
    const description = rest.slice(0, amountStart).trim().replace(/\s+/g, ' ');

    // Skip saldo rows and header noise
    if (/^SALDO DO DIA/i.test(description)) continue;
    if (!description || /^data\s+lançamentos/i.test(description)) continue;

    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;

    out.push({
      date: parseDate(dmy),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      description,
      originalId: '',
    });
  }
  return out;
}

export function detectItauPdf(text) {
  return /extrato conta/i.test(text) && /lançamentos/i.test(text) && /itau|itaú/i.test(text);
}
