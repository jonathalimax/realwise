/**
 * B3 "Posição Consolidada" CSV parser
 * Source: Canal do Investidor — https://www.investidor.b3.com.br
 */

const TYPE_MAP = {
  'acao ordinaria': 'stocks',
  'ação ordinária': 'stocks',
  'acao preferencial': 'stocks',
  'ação preferencial': 'stocks',
  'bdr': 'stocks',
  'unit': 'stocks',
  'fundo de investimento imobiliario': 'fii',
  'fundo de investimento imobiliário': 'fii',
  'fii': 'fii',
  'etf': 'funds',
  'fundo de indice': 'funds',
  'fundo de índice': 'funds',
};

function detectB3(headers) {
  const normalized = headers.map(h =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  );
  return (
    normalized.some(h => h.includes('codigo de negociacao') || h === 'codigo') &&
    normalized.some(h => h.includes('quantidade'))
  );
}

function parseB3Positions(data) {
  const positions = [];
  for (const row of data) {
    const ticker = (
      row['Código de Negociação'] ||
      row['Codigo de Negociacao'] ||
      row['código de negociação'] ||
      ''
    ).trim().toUpperCase();
    if (!ticker) continue;

    const quantityStr = row['Quantidade'] || row['quantidade'] || row['QUANTIDADE'] || '0';
    const quantity = parseBRNumber(quantityStr);
    if (quantity <= 0) continue;

    const currentValueStr =
      row['Valor Atualizado'] || row['valor atualizado'] || row['VALOR ATUALIZADO'] || '0';
    const currentValue = parseBRNumber(currentValueStr);

    const typeRaw = (row['Tipo'] || row['tipo'] || row['TIPO'] || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const type = TYPE_MAP[typeRaw] || 'stocks';

    const broker = (
      row['Escriturador'] || row['escriturador'] ||
      row['Instituição'] || row['instituicao'] || ''
    ).trim();

    positions.push({ ticker, quantity, currentValue, type, broker });
  }
  return positions;
}

function parseBRNumber(str) {
  if (!str && str !== 0) return 0;
  if (typeof str === 'number') return str;
  const cleaned = String(str).replace(/[R$\s]/g, '').trim();
  return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
}

module.exports = { detectB3, parseB3Positions, parseBRNumber };
