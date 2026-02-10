/**
 * Server-side bank statement parsers
 * Mirrors the client-side parsers in src/services/importers/bankParsers/
 */

// ============================================================
// NUBANK PARSER
// ============================================================

/**
 * Detect if headers match Nubank format
 */
function detectNubank(headers) {
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

/**
 * Parse Nubank statement
 */
function parseNubankStatement(data) {
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

    return {
      date: parseDateBR(row['Data'] || row['data']),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description: row['Descricao'] || row['descricao'] || row['Descrição'] || row['descrição'] || '',
      originalId: row['Identificador'] || row['identificador'] || ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

function parseNubankCreditCard(data) {
  return data.map(row => {
    const amountStr = row['amount'] || row['Amount'] || '';
    const amount = parseBrazilianNumber(amountStr);

    return {
      date: parseDateBR(row['date'] || row['Date']),
      amount: Math.abs(amount),
      type: 'expense',
      description: row['title'] || row['Title'] || '',
      originalId: ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

// ============================================================
// ITAÚ PARSER
// ============================================================

/**
 * Detect if headers match Itaú format
 */
function detectItau(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return lowerHeaders.includes('data') &&
    (lowerHeaders.includes('lancamento') || lowerHeaders.includes('lançamento')) &&
    lowerHeaders.includes('valor');
}

/**
 * Parse Itaú statement
 */
function parseItauStatement(data) {
  return data.map(row => {
    const valorStr = row['Valor'] || row['valor'] || row['VALOR'] || '';
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;

    return {
      date: parseDateBR(row['Data'] || row['data'] || row['DATA']),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description: row['Lancamento'] || row['lancamento'] || row['LANCAMENTO'] ||
        row['Lançamento'] || row['Descrição'] || row['descricao'] || '',
      originalId: ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

// ============================================================
// BRADESCO PARSER
// ============================================================

/**
 * Detect if headers match Bradesco format
 */
function detectBradesco(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return lowerHeaders.includes('data') &&
    (lowerHeaders.includes('historico') || lowerHeaders.includes('histórico')) &&
    (lowerHeaders.includes('credito') || lowerHeaders.includes('debito'));
}

/**
 * Parse Bradesco statement
 */
function parseBradescoStatement(data) {
  return data.map(row => {
    let creditoStr = row['Credito'] || row['crédito'] || row['CREDITO'] || '';
    let debitoStr = row['Debito'] || row['débito'] || row['DEBITO'] || '';

    let amount = 0;
    let type = 'expense';

    if (creditoStr || debitoStr) {
      const credito = parseFloat(creditoStr.replace(/\./g, '').replace(',', '.')) || 0;
      const debito = parseFloat(debitoStr.replace(/\./g, '').replace(',', '.')) || 0;

      if (credito > 0) {
        amount = credito;
        type = 'income';
      } else {
        amount = debito;
        type = 'expense';
      }
    } else {
      const valorStr = row['Valor'] || row['valor'] || row['VALOR'] || '';
      const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;
      amount = Math.abs(valor);
      type = valor < 0 ? 'expense' : 'income';
    }

    return {
      date: parseDateBR(row['Data'] || row['data'] || row['DATA']),
      amount: amount,
      type: type,
      description: row['Historico'] || row['histórico'] || row['HISTORICO'] ||
        row['Descrição'] || row['descricao'] || row['Descriçao'] || '',
      originalId: row['Docto'] || row['docto'] || row['DOCTO'] || ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

// ============================================================
// GENERIC PARSER
// ============================================================

/**
 * Parse generic statement (fallback for unknown formats)
 */
function parseGenericStatement(data) {
  if (!data || data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const lowerHeaders = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  // Try to find common column names
  const dateColumns = ['data', 'date', 'dt', 'fecha'];
  const amountColumns = ['valor', 'amount', 'value', 'vlr', 'quantia'];
  const descColumns = ['descricao', 'description', 'desc', 'historico', 'lancamento', 'title', 'nome'];

  let dateCol = null;
  let amountCol = null;
  let descCol = null;

  // Find matching columns
  for (let i = 0; i < headers.length; i++) {
    const lower = lowerHeaders[i];
    if (!dateCol && dateColumns.some(d => lower.includes(d))) {
      dateCol = headers[i];
    }
    if (!amountCol && amountColumns.some(a => lower.includes(a))) {
      amountCol = headers[i];
    }
    if (!descCol && descColumns.some(d => lower.includes(d))) {
      descCol = headers[i];
    }
  }

  // If we couldn't find columns by name, try by position/content
  if (!dateCol || !amountCol || !descCol) {
    const firstRow = data[0];
    for (const [key, value] of Object.entries(firstRow)) {
      if (!dateCol && isDateLike(value)) {
        dateCol = key;
      }
      if (!amountCol && isAmountLike(value)) {
        amountCol = key;
      }
      if (!descCol && isDescriptionLike(value)) {
        descCol = key;
      }
    }
  }

  // If still missing critical columns, return empty
  if (!amountCol) {
    console.warn('Could not detect amount column in generic parser');
    return [];
  }

  return data.map(row => {
    const valorStr = row[amountCol] || '';
    const valor = parseBrazilianNumber(valorStr);

    // Check if description indicates income
    const description = descCol ? (row[descCol] || '').toString() : '';
    const incomeKeywords = ['SALARIO', 'CREDITO', 'DEPOSITO', 'DIVIDENDO', 'RENDIMENTO', 'RECEBIDO', 'RECEBIDA'];
    const isIncome = incomeKeywords.some(k => description.toUpperCase().includes(k));

    return {
      date: dateCol ? parseDateBR(row[dateCol]) : new Date().toISOString(),
      amount: Math.abs(valor),
      type: valor > 0 || isIncome ? 'income' : 'expense',
      description: description,
      originalId: ''
    };
  }).filter(t => t.amount > 0);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Parse Brazilian number format (auto-detect US vs BR)
 */
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
  } else if (lastComma === -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    const afterLastDot = cleaned.substring(lastDot + 1);

    if (dotCount === 1 && afterLastDot.length <= 2) {
      value = parseFloat(cleaned) || 0;
    } else {
      value = parseFloat(cleaned.replace(/\./g, '')) || 0;
    }
  } else if (lastDot === -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    const afterLastComma = cleaned.substring(lastComma + 1);

    if (commaCount === 1 && afterLastComma.length <= 2) {
      value = parseFloat(cleaned.replace(',', '.')) || 0;
    } else {
      value = parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  } else if (lastDot > lastComma) {
    value = parseFloat(cleaned.replace(/,/g, '')) || 0;
  } else {
    value = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }

  return isNegative ? -value : value;
}

/**
 * Parse date in Brazilian format (DD/MM/YYYY) or ISO format
 */
function parseDateBR(dateStr) {
  if (!dateStr) return new Date().toISOString();

  // Try DD/MM/YYYY format (Brazilian)
  const brParts = dateStr.split('/');
  if (brParts.length === 3) {
    const [day, month, year] = brParts;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(fullYear, parseInt(month) - 1, parseInt(day)).toISOString();
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

/**
 * Check if a value looks like a date
 */
function isDateLike(value) {
  if (!value) return false;
  const str = value.toString();
  return /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(str) ||
    /\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(str);
}

/**
 * Check if a value looks like an amount
 */
function isAmountLike(value) {
  if (!value) return false;
  const str = value.toString();
  return /^-?[R$\s]*[\d.,]+$/.test(str.trim());
}

/**
 * Check if a value looks like a description
 */
function isDescriptionLike(value) {
  if (!value) return false;
  const str = value.toString();
  return str.length > 5 && /[a-zA-Z]/.test(str);
}

module.exports = {
  // Nubank
  detectNubank,
  parseNubankStatement,
  // Itaú
  detectItau,
  parseItauStatement,
  // Bradesco
  detectBradesco,
  parseBradescoStatement,
  // Generic
  parseGenericStatement,
  // Utilities
  parseBrazilianNumber,
  parseDateBR
};
