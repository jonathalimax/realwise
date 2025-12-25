// Generic parser that tries to auto-detect columns

const DATE_COLUMNS = ['data', 'date', 'dt', 'Data', 'Date', 'DATA'];
const AMOUNT_COLUMNS = ['valor', 'amount', 'value', 'Valor', 'Amount', 'Value', 'VALOR'];
const DESCRIPTION_COLUMNS = ['descricao', 'descrição', 'description', 'desc', 'Descricao', 'Descrição', 'Description', 'DESCRICAO', 'historico', 'histórico', 'Historico', 'Histórico', 'lancamento', 'lançamento', 'Lancamento', 'Lançamento'];

export function parseGenericStatement(data) {
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);

  const dateCol = findColumn(headers, DATE_COLUMNS);
  const amountCol = findColumn(headers, AMOUNT_COLUMNS);
  const descCol = findColumn(headers, DESCRIPTION_COLUMNS);

  if (!dateCol || !amountCol || !descCol) {
    console.warn('Could not detect all required columns:', { dateCol, amountCol, descCol });
    return [];
  }

  return data.map(row => {
    const valorStr = String(row[amountCol] || '');
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;

    return {
      date: parseDate(row[dateCol]),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description: row[descCol] || '',
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

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();

  const str = String(dateStr);

  // Try DD/MM/YYYY format
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(fullYear, parseInt(month) - 1, parseInt(day)).toISOString();
  }

  // Try YYYY-MM-DD format
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  return new Date().toISOString();
}
