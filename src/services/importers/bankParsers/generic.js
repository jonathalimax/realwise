// Generic parser that tries to auto-detect columns

const DATE_COLUMNS = ['data', 'date', 'dt', 'Data', 'Date', 'DATA'];
const AMOUNT_COLUMNS = ['valor', 'amount', 'value', 'Valor', 'Amount', 'Value', 'VALOR'];
const DESCRIPTION_COLUMNS = ['descricao', 'descrição', 'description', 'desc', 'Descricao', 'Descrição', 'Description', 'DESCRICAO', 'historico', 'histórico', 'Historico', 'Histórico', 'lancamento', 'lançamento', 'Lancamento', 'Lançamento', 'title', 'Title'];

// Income keywords to detect income transactions by description
const INCOME_KEYWORDS = [
  'RECEBIDA', 'RECEBIDO', 'CREDITO', 'CRÉDITO',
  'PIX RECEBIDO', 'TED RECEBIDO', 'DOC RECEBIDO',
  'TRANSFERENCIA RECEBIDA', 'TRANSFERÊNCIA RECEBIDA',
  'DEPOSITO', 'DEPÓSITO', 'SALARIO', 'SALÁRIO',
  'RENDIMENTO', 'DIVIDENDO', 'RESGATE'
];

export function parseGenericStatement(data) {
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);

  let dateCol = findColumn(headers, DATE_COLUMNS);
  let amountCol = findColumn(headers, AMOUNT_COLUMNS);
  let descCol = findColumn(headers, DESCRIPTION_COLUMNS);

  // If we couldn't find columns by name, try to detect by position/content
  if (!dateCol || !amountCol || !descCol) {
    const detected = detectColumnsByContent(data[0], headers);
    dateCol = dateCol || detected.dateCol;
    amountCol = amountCol || detected.amountCol;
    descCol = descCol || detected.descCol;
  }

  if (!dateCol || !amountCol || !descCol) {
    console.warn('Could not detect all required columns:', { dateCol, amountCol, descCol, headers });
    return [];
  }

  return data.map(row => {
    const valorStr = String(row[amountCol] || '');
    const valor = parseSmartNumber(valorStr);
    const description = row[descCol] || '';

    // Determine type: first by value sign, then check description for income keywords
    let type = valor < 0 ? 'expense' : 'income';

    // For positive values, also check if description contains income keywords
    // This helps when all values are positive but some are income
    if (valor > 0) {
      const normalizedDesc = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isIncomeByDescription = INCOME_KEYWORDS.some(keyword => {
        const normalizedKeyword = keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normalizedDesc.includes(normalizedKeyword);
      });
      // Only set as income if description suggests it, otherwise default to expense
      // (most positive values in statements are expenses being displayed as positive)
      type = isIncomeByDescription ? 'income' : 'expense';
    }

    return {
      date: parseDate(row[dateCol]),
      amount: Math.abs(valor),
      type,
      description,
      originalId: ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

function findColumn(headers, candidates) {
  const normalizedHeaders = headers.map(h =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const index = normalizedHeaders.indexOf(normalizedCandidate);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

// Detect columns by analyzing the content of the first row
function detectColumnsByContent(row, headers) {
  let dateCol = null;
  let amountCol = null;
  let descCol = null;

  for (const header of headers) {
    const value = String(row[header] || '');

    // Skip empty values
    if (!value.trim()) continue;

    // Check if it looks like a date
    if (!dateCol && looksLikeDate(value)) {
      dateCol = header;
      continue;
    }

    // Check if it looks like a number/amount
    if (!amountCol && looksLikeAmount(value)) {
      amountCol = header;
      continue;
    }

    // Check if it looks like a description (long text, not a date or number)
    if (!descCol && value.length > 10 && !looksLikeDate(value) && !looksLikeAmount(value)) {
      descCol = header;
    }
  }

  return { dateCol, amountCol, descCol };
}

function looksLikeDate(value) {
  // Check for common date patterns
  const datePatterns = [
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}\/\d{2}\/\d{2}$/, // DD/MM/YY
    /^\d{4}-\d{2}-\d{2}$/,   // YYYY-MM-DD
    /^\d{2}-\d{2}-\d{4}$/,   // DD-MM-YYYY
  ];
  return datePatterns.some(pattern => pattern.test(value.trim()));
}

function looksLikeAmount(value) {
  // Check if value looks like a currency amount
  const cleaned = value.replace(/[R$\s]/g, '').trim();
  // Match patterns like: 1234.56, 1.234,56, -1234.56, 1234,56
  return /^-?[\d.,]+$/.test(cleaned) && cleaned.length <= 15;
}

// Smart number parser that auto-detects US vs Brazilian format
function parseSmartNumber(str) {
  if (!str || typeof str !== 'string') {
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

  const str = String(dateStr);

  // Try DD/MM/YYYY format
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day), 12, 0, 0).toISOString();
  }

  // Try YYYY-MM-DD format — parse manually to use noon local time
  const isoParts = str.split('-');
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    const [y, m, d] = isoParts.map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d, 12, 0, 0).toISOString();
    }
  }

  return new Date().toISOString();
}
