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

  // DD-MM-YYYY (Mercado Pago format) or YYYY-MM-DD (ISO)
  const dashParts = dateStr.split('-');
  if (dashParts.length === 3) {
    const [a, b, c] = dashParts;
    if (c.length === 4) {
      // DD-MM-YYYY
      return new Date(parseInt(c), parseInt(b) - 1, parseInt(a), 12, 0, 0).toISOString();
    }
    if (a.length === 4) {
      // YYYY-MM-DD — parse manually to use noon local time
      return new Date(parseInt(a), parseInt(b) - 1, parseInt(c), 12, 0, 0).toISOString();
    }
  }

  // Fallback — extract date parts to avoid UTC midnight
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0).toISOString();
  }

  return new Date().toISOString();
}
