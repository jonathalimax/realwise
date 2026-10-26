/**
 * Helpers to recognise transfers between the household's own accounts from statement descriptions.
 * Pure functions: no I/O, so the matching rules are easy to read and reason about.
 */

const strip = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words that describe the kind of operation, not the counterparty. */
const NOISE = new Set([
  'PIX', 'TED', 'DOC', 'TRANSF', 'TRANSFERENCIA', 'ENVIADO', 'ENVIADA', 'RECEBIDO', 'RECEBIDA', 'PARA', 'DE', 'DA', 'DO',
  'PAGAMENTO', 'REALIZADO', 'REALIZADA', 'ENTRE', 'CONTAS', 'CONTA', 'BANCO', 'AG', 'CC', 'CPF', 'S', 'A', 'LTDA', 'SA',
]);

/** The words of a description that identify who the money went to / came from. */
export function counterpartyTokens(description: string): string[] {
  return strip(description)
    .split(' ')
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+$/.test(t));
}

/**
 * True when the description names the given account holder: first AND last name of the holder both appear
 * (tolerates middle names and abbreviations). Needs at least two name parts to avoid matching on a first name alone.
 */
export function matchesHolder(description: string, holderName: string | null | undefined): boolean {
  if (!holderName) return false;
  const parts = strip(holderName).split(' ').filter((t) => t.length > 1);
  if (parts.length < 2) return false;
  const haystack = new Set(strip(description).split(' '));
  return haystack.has(parts[0]) && haystack.has(parts[parts.length - 1]);
}

/** Card-invoice payments made from a bank account: they duplicate the invoice's own purchases if counted. */
export function looksLikeInvoicePayment(description: string): boolean {
  const d = strip(description);
  return /\b(PAGAMENTO|PGTO|PAG)\b.*\b(FATURA|CARTAO)\b/.test(d) || /\bFATURA\b.*\b(CARTAO|PAGA)/.test(d);
}

export interface PairCandidate {
  id: string;
  type: 'income' | 'expense';
  accountId: string | null;
  amount: string;
  date: string;
}

const DAY_MS = 86_400_000;
export const MAX_PAIR_DAYS = 3;

/**
 * Pairs the two sides of the same transfer: an expense out of one account and an income into a DIFFERENT account
 * with the same amount, at most MAX_PAIR_DAYS apart. Closest dates are paired first; each row is used once.
 */
export function pairTransfers(rows: PairCandidate[]): [string, string][] {
  const outs = rows.filter((r) => r.type === 'expense');
  const ins = rows.filter((r) => r.type === 'income');
  const used = new Set<string>();
  const pairs: [string, string][] = [];

  const candidates: { out: PairCandidate; inn: PairCandidate; gap: number }[] = [];
  for (const out of outs) {
    for (const inn of ins) {
      if (out.accountId && inn.accountId && out.accountId === inn.accountId) continue;
      if (Number(out.amount).toFixed(2) !== Number(inn.amount).toFixed(2)) continue;
      const gap = Math.abs(Date.parse(out.date) - Date.parse(inn.date)) / DAY_MS;
      if (gap <= MAX_PAIR_DAYS) candidates.push({ out, inn, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap);
  for (const c of candidates) {
    if (used.has(c.out.id) || used.has(c.inn.id)) continue;
    used.add(c.out.id);
    used.add(c.inn.id);
    pairs.push([c.out.id, c.inn.id]);
  }
  return pairs;
}
