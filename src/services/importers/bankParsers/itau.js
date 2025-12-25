// Itau format:
// Data, Lancamento, Valor, Saldo (or similar variations)

export function parseItauStatement(data) {
  return data.map(row => {
    const valorStr = row['Valor'] || row['valor'] || row['VALOR'] || '';
    // Itau uses format like "1.234,56" or "-1.234,56"
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;

    return {
      date: parseDate(row['Data'] || row['data'] || row['DATA']),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description: row['Lancamento'] || row['lancamento'] || row['LANCAMENTO'] ||
                   row['Lançamento'] || row['Descrição'] || row['descricao'] || '',
      originalId: ''
    };
  }).filter(t => t.amount > 0 && t.description);
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();

  // Try DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(fullYear, parseInt(month) - 1, parseInt(day)).toISOString();
  }

  // Try YYYY-MM-DD format
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  return new Date().toISOString();
}

export function detectItau(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return lowerHeaders.includes('data') &&
         (lowerHeaders.includes('lancamento') || lowerHeaders.includes('lançamento')) &&
         lowerHeaders.includes('valor');
}
