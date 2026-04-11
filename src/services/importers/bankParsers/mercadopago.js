// Mercado Pago account/checking statement (extrato conta corrente)
// CSV format (semicolon-delimited, two sections):
//   Section 1 (summary): INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE
//   Section 2 (transactions): RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
//
// Date format: DD-MM-YYYY
// Amounts: Brazilian format (1.234,56)
// Sign convention: negative = expense, positive = income or internal transfer

// Internal transfer keywords — these are Mercado Pago pocket movements, not real transactions
const INTERNAL_KEYWORDS = [
  'dinheiro reservado',
  'dinheiro retirado',
];

export function parseMercadopagoStatement(data) {
  return data.map(row => {
    const amountStr = row['TRANSACTION_NET_AMOUNT'] || '';
    const amount = parseBrazilianNumber(amountStr);
    const description = row['TRANSACTION_TYPE'] || '';

    // Internal pocket transfers cancel each other out — skip them
    const normalizedDesc = description.toLowerCase();
    const isInternal = INTERNAL_KEYWORDS.some(kw => normalizedDesc.startsWith(kw));
    if (isInternal) return null;

    // Negative amount = expense (Pix enviado, Pagamento, etc.)
    // Positive amount = income (Pix recebido, deposits, etc.)
    const type = amount < 0 ? 'expense' : 'income';

    return {
      date: parseDate(row['RELEASE_DATE']),
      amount: Math.abs(amount),
      type,
      description,
      originalId: row['REFERENCE_ID'] || '',
    };
  }).filter(t => t !== null && t.amount > 0 && t.description);
}

export function detectMercadopago(headers) {
  const normalized = headers.map(h => h.trim().toUpperCase());
  return (
    normalized.includes('RELEASE_DATE') &&
    normalized.includes('TRANSACTION_TYPE') &&
    normalized.includes('TRANSACTION_NET_AMOUNT')
  );
}

function parseBrazilianNumber(str) {
  if (!str || typeof str !== 'string') {
    if (typeof str === 'number') return str;
    return 0;
  }

  let cleaned = str.replace(/[R$\s]/g, '').trim();
  const isNegative = cleaned.startsWith('-');
  cleaned = cleaned.replace('-', '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let value;
  if (lastComma === -1 && lastDot === -1) {
    value = parseFloat(cleaned) || 0;
  } else if (lastComma > lastDot) {
    // BR format: 1.234,56
    value = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  } else {
    // US format: 1,234.56
    value = parseFloat(cleaned.replace(/,/g, '')) || 0;
  }

  return isNegative ? -value : value;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();

  // DD-MM-YYYY (Mercado Pago format)
  const dashParts = dateStr.split('-');
  if (dashParts.length === 3) {
    const [day, month, year] = dashParts;
    if (year.length === 4) {
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
    }
    // Could also be YYYY-MM-DD (ISO)
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) return isoDate.toISOString();
  }

  // Fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return new Date().toISOString();
}
