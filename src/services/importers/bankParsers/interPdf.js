// Inter checking-account PDF text format (extracted via pdfjs-dist).
// The PDF uses Portuguese prose dates as day section headers:
//   "9 de Fevereiro de 2026   Saldo do dia:   R$ 3,31"
// Each transaction has a quoted description, followed by amount and balance:
//   Category: "description"   [-]R$ amount   [-]R$ balance
// Negative amounts are expenses; positive are income.

const MONTHS_PT = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3,
  maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8,
  outubro: 9, novembro: 10, dezembro: 11,
};

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Matches: "9 de Fevereiro de 2026"
const DATE_HEADER_RE = /(\d{1,2})\s+de\s+([A-Za-zÀ-ɏ]+)\s+de\s+(\d{4})/g;

// Each transaction has a quoted description token followed by two R$ amounts.
// e.g. "INTER PRE 15GB MENSAL"   R$ 3,00   R$ 3,31
// e.g. "Debito Automatico Fatura Cartao Inter"   -R$ 651,40   -R$ 648,09
const TX_RE = /"([^"]+)"\s+(-?R\$\s*[\d.]+,\d{2})\s+(-?R\$\s*[\d.]+,\d{2})/g;

export function parseInterPdf(text) {
  const flat = text.replace(/\s+/g, ' ').trim();

  // Build date sections
  const dateSections = [];
  DATE_HEADER_RE.lastIndex = 0;
  let dm;
  while ((dm = DATE_HEADER_RE.exec(flat)) !== null) {
    const day = parseInt(dm[1], 10);
    const monthName = stripDiacritics(dm[2].toLowerCase());
    const year = parseInt(dm[3], 10);
    const monthNum = MONTHS_PT[monthName];
    if (monthNum == null) continue;
    dateSections.push({
      isoDate: new Date(year, monthNum, day).toISOString(),
      pos: dm.index,
      endPos: dm.index + dm[0].length,
    });
  }

  if (dateSections.length === 0) return [];

  const out = [];

  for (let i = 0; i < dateSections.length; i++) {
    const section = dateSections[i];
    const start = section.endPos;
    const end = i + 1 < dateSections.length ? dateSections[i + 1].pos : flat.length;
    const chunk = flat.slice(start, end);

    TX_RE.lastIndex = 0;
    let m;
    while ((m = TX_RE.exec(chunk)) !== null) {
      const [, description, amountStr] = m;
      if (!description) continue;

      const raw = amountStr.trim();
      const isNegative = raw.startsWith('-');
      const amount = parseBrAmount(raw.replace('-', ''));

      if (!Number.isFinite(amount) || amount === 0) continue;

      out.push({
        date: section.isoDate,
        amount: Math.abs(amount),
        type: isNegative ? 'expense' : 'income',
        description,
        originalId: '',
      });
    }
  }

  return out;
}

export function detectInterPdf(text) {
  return /Banco Inter/i.test(text) && /Saldo do dia|Pix recebido|Pagamento efetuado/i.test(text);
}
