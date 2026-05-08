// Mercado Pago credit card bill (fatura) PDF text parser.
// "Vence em DD/MM/YYYY" → year inference.
// Each row: DD/MM <description tokens> <amount> [<installment x/y>]
// All entries are expenses. "Pagamento da fatura" rows are skipped.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const ROW_RE = /(\d{2}\/\d{2}(?:\/\d{4})?)\s+([^\d][^]*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d+\/\d+))?/g;

export function parseMercadoPagoPdf(text) {
  const flat = text.replace(/\s+/g, ' ');
  const venceMatch = flat.match(/Vence em \d{2}\/\d{2}\/(\d{4})/);
  const inferredYear = venceMatch ? venceMatch[1] : String(new Date().getFullYear());

  const out = [];
  ROW_RE.lastIndex = 0;
  let m;
  while ((m = ROW_RE.exec(flat)) !== null) {
    const [, rawDate, descRaw, amountStr, installment] = m;
    const description = descRaw.trim().replace(/\s+/g, ' ');
    if (/Pagamento da fatura/i.test(description)) continue;
    if (!description) continue;
    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    let dmy = rawDate;
    if (!/\d{4}$/.test(dmy)) dmy = `${dmy}/${inferredYear}`;
    const [d, mo, y] = dmy.split('/');
    out.push({
      date: new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).toISOString(),
      amount: Math.abs(amount),
      type: 'expense',
      description: installment ? `${description} (${installment})` : description,
      originalId: '',
    });
  }
  return out;
}

export function detectMercadoPagoPdf(text) {
  return /Mercado Pago/i.test(text) && /Vence em|Fatura|Crédito do mês/i.test(text);
}
