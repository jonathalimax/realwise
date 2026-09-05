// AstroPay statement (extrato) PDF text parser.
// Header line: "<d> <mês pt> <yyyy> - <d> <mês pt> <yyyy>" — used to infer statement year/month.
// Row shape: MM/DD <description> <amount> <balance> (NOTE: month/day order, not the usual DD/MM).
// Amounts use BR numeric format (. thousands, , decimal); leading '-' marks an expense.
// "Saldo Inicial"/"Saldo Final" rows are opening/closing balance, not transactions.
// Repeating page boilerplate (disclaimers, section headers) must be stripped before matching.

const PT_MONTHS = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Boilerplate lines/fragments that repeat per page and must not be treated as transaction text.
const BOILERPLATE_RES = [
  /Este extrato é um documento informativo[^.]*\.?/gi,
  /Histórico de transações/gi,
  /Data\s+Descrição\s+Quantia\s+Equilíbrio/gi,
];

const PERIOD_RE = /(\d{1,2})\s+([a-zç]+)\s+(\d{4})\s*-\s*\d{1,2}\s+([a-zç]+)\s+(\d{4})/i;

// MM/DD <description...> <amount> <balance>
const ROW_RE = /(\d{2})\/(\d{2})\s+([^\d][^]*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s+\d{2}\/\d{2}\s|\s*$)/g;

export function parseAstroPayPdf(text) {
  let flat = text.replace(/\s+/g, ' ').trim();
  for (const re of BOILERPLATE_RES) {
    flat = flat.replace(re, ' ');
  }
  flat = flat.replace(/\s+/g, ' ').trim();

  const periodMatch = flat.match(PERIOD_RE);
  const startYear = periodMatch ? parseInt(periodMatch[3], 10) : new Date().getFullYear();
  const startMonth = periodMatch ? PT_MONTHS[periodMatch[2].toLowerCase()] : null;
  const endYear = periodMatch ? parseInt(periodMatch[5], 10) : startYear;
  const endMonth = periodMatch ? PT_MONTHS[periodMatch[4].toLowerCase()] : null;
  // Default year for rows falls back to the period start year; rows matching the end
  // month (which may fall in a different year in the rare year-boundary case, e.g.
  // "28 dezembro 2026 - 27 janeiro 2027") use the end year instead.
  const inferredYear = startYear;

  const out = [];
  let skippedCount = 0;
  ROW_RE.lastIndex = 0;
  let m;
  while ((m = ROW_RE.exec(flat)) !== null) {
    const [, mm, dd, descRaw, amountStr] = m;
    const description = descRaw.trim().replace(/\s+/g, ' ');

    if (!description) continue;
    if (/Saldo Inicial|Saldo Final/i.test(description)) continue;

    const month = parseInt(mm, 10);
    const day = parseInt(dd, 10);

    // Sanity-check the row's month against the statement period (which may span two
    // calendar months); skip if it matches neither, rather than risk emitting a
    // wrongly-dated transaction (dates in this format are MM/DD).
    let year = inferredYear;
    if (startMonth && endMonth) {
      if (month === startMonth) {
        year = startYear;
      } else if (month === endMonth) {
        year = endYear;
      } else {
        skippedCount++;
        continue;
      }
    } else if (startMonth && month !== startMonth) {
      skippedCount++;
      continue;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const row = {
      date: new Date(year, month - 1, day, 12, 0, 0).toISOString(),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      description,
      originalId: '',
    };

    // AstroPay cashback rows are effectively investment returns, not general
    // income, so categorize them explicitly rather than relying on the shared
    // keyword rule engine (which is shared with unrelated "Reembolso" rules).
    if (/cashback/i.test(description)) {
      row.category = 'Investimentos';
    }

    out.push(row);
  }
  return { transactions: out, skippedCount };
}

export function detectAstroPayPdf(text) {
  return /Astro Instituição de Pagamento|AstroPay|astropay\.com/i.test(text)
    && /Histórico de transações|Equilíbrio/i.test(text);
}
