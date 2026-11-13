// Single source of truth for banks, fintechs and wallets (Brazil first).
//
// - `id`      stable key stored in user data (existing ids are kept as-is).
// - `code`    COMPE code, when the institution has one.
// - `logo`    file name (without extension) in /public/banks, only when a real
//             brand logo was obtained. Without it the UI renders a monogram tile.
// - `brand`   brand color (hex) used for the monogram fallback tile.
// - `color`   legacy Tailwind color key (see BANK_COLORS) used by card UIs.
// - `aliases` extra names used to match whatever users already saved.

export const BANK_COLORS = {
  purple: { bg: 'bg-purple-600', light: 'bg-purple-100', text: 'text-purple-600' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600' },
  rose: { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-600' },
  amber: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600' },
  blue: { bg: 'bg-blue-600', light: 'bg-blue-100', text: 'text-blue-600' },
  slate: { bg: 'bg-slate-700', light: 'bg-slate-100', text: 'text-slate-700' },
  emerald: { bg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-600' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-600' },
};

const b = (id, name, code, logo, brand, color, aliases = []) => ({
  id, name, code, logo, brand, color, aliases,
});

export const BANKS = [
  // Most used first (kept in the original picker order)
  b('nubank', 'Nubank', '260', 'nubank', '#820AD1', 'purple', ['Nu Pagamentos', 'Nu Pagamentos S.A.', 'Nu Bank', 'Roxinho', 'Nu']),
  b('itau', 'Itaú', '341', 'itau', '#EC7000', 'orange', ['Itaú Unibanco', 'Itau Unibanco', 'Banco Itaú', 'Banco Itau']),
  b('bradesco', 'Bradesco', '237', 'bradesco', '#CC092F', 'rose', ['Banco Bradesco']),
  b('santander', 'Santander', '033', 'santander', '#EC0000', 'rose', ['Banco Santander', 'Santander Brasil']),
  b('bb', 'Banco do Brasil', '001', 'bb', '#FAE128', 'amber', ['BB', 'Banco do Brasil S.A.', 'Bco do Brasil', 'Ourocard']),
  b('caixa', 'Caixa', '104', 'caixa', '#005CA9', 'blue', ['Caixa Econômica Federal', 'Caixa Economica', 'CEF', 'Caixa Econômica']),
  b('inter', 'Inter', '077', 'inter', '#FF7A00', 'orange', ['Banco Inter', 'Inter&Co', 'Inter Co']),
  b('c6', 'C6 Bank', '336', 'c6', '#242424', 'slate', ['C6', 'Banco C6', 'C6 Bank S.A.']),
  b('btg', 'BTG Pactual', '208', 'btg', '#001E62', 'blue', ['BTG', 'Banco BTG Pactual', 'BTG Pactual Digital']),
  b('xp', 'XP', '348', 'xp', '#101010', 'slate', ['XP Investimentos', 'Banco XP', 'XP Inc']),
  b('picpay', 'PicPay', '380', 'picpay', '#21C25E', 'emerald', ['Pic Pay']),
  b('mercadopago', 'Mercado Pago', '323', 'mercadopago', '#00B1EA', 'cyan', ['MercadoPago', 'Mercado Pago IP', 'Mercado Livre']),
  b('neon', 'Neon', '536', null, '#00E5E5', 'cyan', ['Neon Pagamentos', 'Banco Neon']),
  b('next', 'Next', '237', null, '#00FF5F', 'emerald', ['Banco Next', 'Next Bradesco']),
  b('original', 'Banco Original', '212', 'original', '#00A650', 'emerald', ['Original', 'Banco Original S.A.']),
  b('pan', 'Banco Pan', '623', 'pan', '#00AEEF', 'blue', ['Pan', 'Banco Panamericano', 'Panamericano']),
  b('astropay', 'AstroPay', null, null, '#7C3AED', 'purple', ['Astro Pay']),

  b('safra', 'Banco Safra', '422', null, '#0A2A5E', 'blue', ['Safra', 'Banco Safra S.A.']),
  b('sicoob', 'Sicoob', '756', 'sicoob', '#003641', 'emerald', ['Banco Sicoob', 'Bancoob', 'Cooperativa Sicoob']),
  b('sicredi', 'Sicredi', '748', 'sicredi', '#3FA110', 'emerald', ['Banco Cooperativo Sicredi', 'Bansicredi']),
  b('banrisul', 'Banrisul', '041', 'banrisul', '#0067B1', 'blue', ['Banco do Estado do Rio Grande do Sul']),
  b('bs2', 'Banco BS2', '218', 'bs2', '#1A1A2E', 'slate', ['BS2', 'Banco BS2 S.A.']),
  b('willbank', 'Will Bank', '280', null, '#FFD60A', 'amber', ['Will', 'WillBank', 'Will Financeira']),
  b('agibank', 'Agibank', '121', 'agibank', '#0D9488', 'emerald', ['Agi', 'Banco Agibank', 'Agiplan']),
  b('pagbank', 'PagBank', '290', null, '#00A859', 'emerald', ['PagSeguro', 'Pag Seguro', 'PagBank PagSeguro', 'Banco PagSeguro', 'PagSeguro Internet']),
  b('pay99', '99Pay', null, null, '#FFC700', 'amber', ['99 Pay', '99Pay', '99 Food Pay']),
  b('iti', 'iti', '341', null, '#FF6B00', 'orange', ['iti Itaú', 'iti Itau', 'Iti']),
  b('digio', 'Digio', '335', 'digio', '#0B3D91', 'blue', ['Banco Digio', 'Dígio', 'Banco Dígio']),
  b('bmg', 'Banco Bmg', '318', 'bmg', '#F26522', 'orange', ['BMG', 'Bmg Bank']),
  b('daycoval', 'Daycoval', '707', null, '#003A70', 'blue', ['Banco Daycoval', 'Bank Daycoval']),
  b('mercantil', 'Banco Mercantil', '389', 'mercantil', '#E30613', 'rose', ['Mercantil', 'Mercantil do Brasil', 'Banco Mercantil do Brasil']),
  b('bv', 'Banco BV', '413', 'bv', '#0050A0', 'blue', ['BV', 'Votorantim', 'Banco Votorantim', 'bv Financeira']),
  b('sofisa', 'Banco Sofisa', '637', 'sofisa', '#00A0DF', 'cyan', ['Sofisa', 'Sofisa Direto', 'Sofisa Direct']),
  b('unicred', 'Unicred', '136', 'unicred', '#0E7C3A', 'emerald', ['Unicred Cooperativa', 'Cooperativa Unicred']),
  b('cresol', 'Cresol', '133', null, '#00843D', 'emerald', ['Sicredi Cresol', 'Banco Cresol']),
  b('ailos', 'Ailos', '085', null, '#0072BC', 'blue', ['Cooperativa Ailos', 'Viacredi']),
  b('basa', 'Banco da Amazônia', '003', 'basa', '#00704A', 'emerald', ['Basa', 'Banco da Amazonia']),
  b('bnb', 'Banco do Nordeste', '004', 'bnb', '#D6001C', 'rose', ['BNB', 'Banco do Nordeste do Brasil']),
  b('brb', 'BRB', '070', null, '#0057A8', 'blue', ['Banco de Brasília', 'Banco de Brasilia', 'BRB Banco de Brasília']),
  b('banestes', 'Banestes', '021', 'banestes', '#0066B3', 'blue', ['Banco do Estado do Espírito Santo', 'Banco do Estado do Espirito Santo']),
  b('banese', 'Banese', '047', 'banese', '#0056A4', 'blue', ['Banco do Estado de Sergipe']),
  b('banpara', 'Banpará', '037', null, '#0072BB', 'blue', ['Banpara', 'Banco do Estado do Pará', 'Banco do Estado do Para']),
  b('abc', 'Banco ABC Brasil', '246', null, '#003E7E', 'blue', ['ABC Brasil', 'ABC', 'Banco ABC']),
  b('pine', 'Banco Pine', '643', null, '#00573F', 'emerald', ['Pine']),
  b('master', 'Banco Master', '243', null, '#1D1D1B', 'slate', ['Banco Máxima', 'Banco Maxima']),
  b('modalmais', 'Modalmais', '746', null, '#0033A0', 'blue', ['Banco Modal', 'Modal', 'Modal Mais']),
  b('genial', 'Genial Investimentos', '125', 'genial', '#00B87C', 'emerald', ['Banco Genial', 'Genial', 'Genial Bank']),
  b('rico', 'Rico', null, null, '#FF6A00', 'orange', ['Rico Investimentos', 'Rico Corretora']),
  b('avenue', 'Avenue', null, null, '#00A7E1', 'cyan', ['Avenue Securities', 'Banco Avenue', 'Avenue Bank']),
  b('nomad', 'Nomad', null, 'nomad', '#FFD21F', 'amber', ['Nomad Global', 'Nomad Fintech']),
  b('cora', 'Cora', '403', null, '#FE3E6D', 'rose', ['Conta Cora', 'Cora SCD']),
  b('stone', 'Stone', '197', null, '#00A868', 'emerald', ['Stone Pagamentos', 'Stone IP']),
  b('ton', 'Ton', null, null, '#00B341', 'emerald', ['Ton Stone', 'Conta Ton']),
  b('cielo', 'Cielo', null, 'cielo', '#00A9E0', 'cyan', ['Cielo S.A.', 'Conta Cielo']),
  b('recargapay', 'RecargaPay', null, null, '#00C2A8', 'emerald', ['Recarga Pay']),
  b('ame', 'Ame Digital', null, null, '#E6007E', 'rose', ['Ame', 'AME Digital Brasil']),
  b('banco24horas', 'Banco24Horas', null, null, '#E4002B', 'rose', ['Banco 24 Horas', 'Tecban']),
  b('revolut', 'Revolut', null, 'revolut', '#0075EB', 'blue', []),
  b('wise', 'Wise', null, 'wise', '#9FE870', 'emerald', ['TransferWise', 'Transfer Wise']),
  b('paypal', 'PayPal', null, 'paypal', '#003087', 'blue', ['Pay Pal']),
  b('binance', 'Binance', null, 'binance', '#F0B90B', 'amber', []),
  b('cash', 'Dinheiro', null, null, '#16A34A', 'emerald', ['Cash', 'Dinheiro em espécie', 'Dinheiro vivo', 'Carteira', 'Efectivo']),
  b('other', 'Outro', null, null, '#475569', 'slate', ['Outros', 'Other', 'Outra']),
];

const OTHER = BANKS[BANKS.length - 1];

// "Nubank" / "NÚBANK" / "nu-bank" -> "nu bank" (lowercase, no accents, no punctuation)
export function normalizeBankText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compact = (s) => s.replace(/ /g, '');

// Lookup structures built once.
const exactIndex = new Map(); // compact normalized text -> bank
const phraseIndex = []; // [{ phrase, bank }] sorted longest first, for "contains" matches

for (const bank of BANKS) {
  if (bank.id === 'other') continue;
  const terms = [bank.id, bank.name, ...bank.aliases];
  for (const term of terms) {
    const n = normalizeBankText(term);
    if (!n) continue;
    const key = compact(n);
    if (!exactIndex.has(key)) exactIndex.set(key, bank);
    phraseIndex.push({ phrase: n, bank });
  }
}
phraseIndex.sort((x, y) => y.phrase.length - x.phrase.length);

const cache = new Map();

/**
 * Resolve any saved bank value (stored id, display name, legacy spelling...)
 * to a known bank. Returns null when nothing matches.
 */
export function matchBank(value) {
  const n = normalizeBankText(value);
  if (!n) return null;
  if (cache.has(n)) return cache.get(n);

  let found = exactIndex.get(compact(n)) || null;
  if (!found) {
    const padded = ` ${n} `;
    const hit = phraseIndex.find(({ phrase }) => padded.includes(` ${phrase} `));
    found = hit ? hit.bank : null;
  }
  cache.set(n, found);
  return found;
}

/** Like matchBank but never null: unknown values fall back to the generic "other" bank. */
export function resolveBank(value) {
  return matchBank(value) || OTHER;
}

/** Public URL of a bank's local logo, or null when only a monogram exists. */
export function getBankLogoUrl(bank) {
  if (!bank?.logo) return null;
  return `${import.meta.env.BASE_URL || '/'}banks/${bank.logo}.svg`;
}

/** Initials for the monogram fallback ("Banco do Brasil" -> "BB", "Foo" -> "F"). */
export function getBankInitials(name) {
  const words = normalizeBankText(name)
    .split(' ')
    .filter((w) => w && !['banco', 'bank', 'do', 'da', 'de', 'dos', 'das', 'e', 'sa', 's'].includes(w));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, words[0].length <= 3 ? words[0].length : 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
