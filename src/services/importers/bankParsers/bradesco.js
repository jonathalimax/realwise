// Bradesco format variations:
// Data, Historico, Docto, Credito, Debito, Saldo
// or
// Data, Descrição, Valor

export function parseBradescoStatement(data) {
  return data.map(row => {
    // Try Credito/Debito format first
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
      // Try single Valor format
      const valorStr = row['Valor'] || row['valor'] || row['VALOR'] || '';
      const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.')) || 0;
      amount = Math.abs(valor);
      type = valor < 0 ? 'expense' : 'income';
    }

    return {
      date: parseDate(row['Data'] || row['data'] || row['DATA']),
      amount: amount,
      type: type,
      description: row['Historico'] || row['histórico'] || row['HISTORICO'] ||
                   row['Descrição'] || row['descricao'] || row['Descriçao'] || '',
      originalId: row['Docto'] || row['docto'] || row['DOCTO'] || ''
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

export function detectBradesco(headers) {
  const lowerHeaders = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return lowerHeaders.includes('data') &&
         (lowerHeaders.includes('historico') || lowerHeaders.includes('histórico')) &&
         (lowerHeaders.includes('credito') || lowerHeaders.includes('debito'));
}
