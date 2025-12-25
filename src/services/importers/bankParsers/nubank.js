// Nubank CSV formats:
// Account (Conta): Data, Valor, Identificador, Descricao
// Credit Card (Cartão): date, title, amount OR Data, Descrição, Valor

export function parseNubankStatement(data) {
  // Detect which format we're dealing with
  const headers = Object.keys(data[0] || {}).map(h => h.toLowerCase());

  // Credit card format (English headers)
  if (headers.includes('title') && headers.includes('amount')) {
    return parseNubankCreditCard(data);
  }

  // Account or credit card format (Portuguese headers)
  return parseNubankAccount(data);
}

function parseNubankAccount(data) {
  return data.map(row => {
    const valorStr = row['Valor'] || row['valor'] || '';
    const valor = parseBrazilianNumber(valorStr);

    // In Nubank bank account statements:
    // - Negative values = money leaving account (expenses, transfers out)
    // - Positive values = money entering account (salary, transfers in)
    return {
      date: parseDate(row['Data'] || row['data']),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description: row['Descricao'] || row['descricao'] || row['Descrição'] || row['descrição'] || '',
      originalId: row['Identificador'] || row['identificador'] || ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

function parseNubankCreditCard(data) {
  return data.map(row => {
    // Credit card uses English column names: date, title, amount
    const amountStr = row['amount'] || row['Amount'] || '';
    const amount = parseBrazilianNumber(amountStr);

    return {
      date: parseDate(row['date'] || row['Date']),
      amount: Math.abs(amount),
      type: 'expense', // Credit card transactions are typically expenses
      description: row['title'] || row['Title'] || '',
      originalId: ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

// Parse number - auto-detect US vs Brazilian format
function parseBrazilianNumber(str) {
  if (!str || typeof str !== 'string') {
    // If it's already a number, return it
    if (typeof str === 'number') return str;
    return 0;
  }

  // Remove currency symbols and whitespace
  let cleaned = str.replace(/[R$\s]/g, '').trim();

  // Check if negative
  const isNegative = cleaned.startsWith('-');
  cleaned = cleaned.replace('-', '');

  // Detect format by analyzing the string
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let value;

  if (lastComma === -1 && lastDot === -1) {
    // No separators: "12345" -> 12345
    value = parseFloat(cleaned) || 0;
  } else if (lastComma === -1) {
    // Only dots: could be "1.234.567" (BR thousands) or "1234.56" (US decimal)
    const dotCount = (cleaned.match(/\./g) || []).length;
    const afterLastDot = cleaned.substring(lastDot + 1);

    if (dotCount === 1 && afterLastDot.length <= 2) {
      // Single dot with 1-2 digits after = US decimal: "1234.56" -> 1234.56
      value = parseFloat(cleaned) || 0;
    } else {
      // Multiple dots or more than 2 digits after = BR thousands: "1.234.567" -> 1234567
      value = parseFloat(cleaned.replace(/\./g, '')) || 0;
    }
  } else if (lastDot === -1) {
    // Only commas: could be "1,234,567" (US thousands) or "1234,56" (BR decimal)
    const commaCount = (cleaned.match(/,/g) || []).length;
    const afterLastComma = cleaned.substring(lastComma + 1);

    if (commaCount === 1 && afterLastComma.length <= 2) {
      // Single comma with 1-2 digits after = BR decimal: "1234,56" -> 1234.56
      value = parseFloat(cleaned.replace(',', '.')) || 0;
    } else {
      // Multiple commas or more than 2 digits after = US thousands: "1,234,567" -> 1234567
      value = parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  } else if (lastDot > lastComma) {
    // Dot comes after comma: US format "1,234.56" -> 1234.56
    value = parseFloat(cleaned.replace(/,/g, '')) || 0;
  } else {
    // Comma comes after dot: BR format "1.234,56" -> 1234.56
    value = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }

  return isNegative ? -value : value;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();

  // Try DD/MM/YYYY format (Brazilian)
  const brParts = dateStr.split('/');
  if (brParts.length === 3) {
    const [day, month, year] = brParts;
    return new Date(year, month - 1, day).toISOString();
  }

  // Try YYYY-MM-DD format (ISO)
  if (dateStr.includes('-')) {
    const isoParts = dateStr.split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const isoDate = new Date(dateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
      }
    }
  }

  // Try parsing as date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

export function detectNubank(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  // Account format
  const isAccount = lowerHeaders.includes('data') &&
         lowerHeaders.includes('valor') &&
         (lowerHeaders.includes('descricao') || lowerHeaders.includes('descrição'));

  // Credit card format (English)
  const isCreditCard = lowerHeaders.includes('date') &&
         lowerHeaders.includes('title') &&
         lowerHeaders.includes('amount');

  return isAccount || isCreditCard;
}
