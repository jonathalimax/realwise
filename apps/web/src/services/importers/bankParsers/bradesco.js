// Bradesco CSV format (real export):
//   Header: Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)
//   Empty cell is a single space ' ' when credit/debit doesn't apply.
//   Date: DD/MM/YYYY ; Amount: BR (1.234,56)

function parseBrAmount(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0).toISOString();
  }
  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return '';
}

const HISTORICO_KEYS = ['Histórico', 'Historico', 'historico', 'histórico', 'HISTORICO'];
const CREDITO_KEYS = ['Crédito (R$)', 'Credito (R$)', 'Crédito', 'Credito', 'CREDITO'];
const DEBITO_KEYS = ['Débito (R$)', 'Debito (R$)', 'Débito', 'Debito', 'DEBITO'];
const DATA_KEYS = ['Data', 'data', 'DATA'];
const DOCTO_KEYS = ['Docto.', 'Docto', 'docto'];

export function parseBradescoStatement(data) {
  const out = [];
  for (const row of data) {
    const rawDate = pick(row, DATA_KEYS);
    const desc = pick(row, HISTORICO_KEYS);

    if (rawDate === 'Data' || desc === 'Histórico') continue;
    if (!rawDate || !desc) continue;
    if (desc === 'Total') continue;
    if (rawDate.startsWith('Filtro') || rawDate.startsWith('Os dados') || rawDate.startsWith('Últimos')) continue;

    const credito = parseBrAmount(pick(row, CREDITO_KEYS));
    const debito = parseBrAmount(pick(row, DEBITO_KEYS));

    let amount, type;
    if (credito > 0 && debito === 0) { amount = credito; type = 'income'; }
    else if (debito > 0 && credito === 0) { amount = debito; type = 'expense'; }
    else continue;

    out.push({
      date: parseDate(rawDate),
      amount,
      type,
      description: desc,
      originalId: pick(row, DOCTO_KEYS),
    });
  }
  return out;
}

function norm(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function detectBradesco(headers) {
  const set = new Set(headers.map(norm));
  const has = (token) => [...set].some(h => h.includes(token));
  return set.has('data') && has('historico') && (has('credito') || has('debito'));
}
