// Inter CSV format (Conta Corrente):
//   Preamble (4 lines): Extrato Conta Corrente / Conta;XXX / Período;... / Saldo;X (then blank)
//   Header: Data Lançamento;Histórico;Descrição;Valor;Saldo
//   Date: DD/MM/YYYY ; Amount: BR with negative sign for expenses

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
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  return new Date().toISOString();
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return '';
}

const DATE_KEYS = ['Data Lançamento', 'Data Lancamento', 'data lançamento'];
const HIST_KEYS = ['Histórico', 'Historico'];
const DESC_KEYS = ['Descrição', 'Descricao'];
const VALOR_KEYS = ['Valor', 'valor', 'VALOR'];

export function parseInterStatement(data) {
  const out = [];
  for (const row of data) {
    const rawDate = pick(row, DATE_KEYS);
    if (!rawDate || rawDate === 'Data Lançamento') continue;
    const valor = parseBrAmount(pick(row, VALOR_KEYS));
    if (valor === 0) continue;
    const hist = pick(row, HIST_KEYS);
    const descMore = pick(row, DESC_KEYS);
    const description = [hist, descMore].filter(Boolean).join(' - ').trim();
    if (!description) continue;
    out.push({
      date: parseDate(rawDate),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description,
      originalId: '',
    });
  }
  return out;
}

function norm(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function detectInter(headers) {
  const set = new Set(headers.map(norm));
  return set.has('data lancamento') && set.has('historico') && set.has('descricao') && set.has('valor');
}
