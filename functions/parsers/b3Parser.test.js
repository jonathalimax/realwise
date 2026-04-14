const test = require('node:test');
const assert = require('node:assert/strict');
const { detectB3, parseB3Positions, parseBRNumber } = require('./b3Parser');

test('detectB3 returns true for B3 headers', () => {
  const headers = ['Produto', 'Código de Negociação', 'Tipo', 'Escriturador', 'Quantidade', 'Valor Atualizado'];
  assert.equal(detectB3(headers), true);
});

test('detectB3 returns false for Nubank headers', () => {
  const headers = ['Data', 'Valor', 'Descrição'];
  assert.equal(detectB3(headers), false);
});

test('parseB3Positions extracts ticker, quantity and type', () => {
  const rows = [{
    'Código de Negociação': 'ITSA4',
    'Tipo': 'Ação Ordinária',
    'Escriturador': 'ITAUSA S.A.',
    'Quantidade': '100',
    'Valor Atualizado': '1.050,00',
  }];
  const [pos] = parseB3Positions(rows);
  assert.equal(pos.ticker, 'ITSA4');
  assert.equal(pos.quantity, 100);
  assert.equal(pos.currentValue, 1050);
  assert.equal(pos.type, 'stocks');
  assert.equal(pos.broker, 'ITAUSA S.A.');
});

test('parseB3Positions maps FII type correctly', () => {
  const rows = [{
    'Código de Negociação': 'MXRF11',
    'Tipo': 'Fundo de Investimento Imobiliário',
    'Quantidade': '200',
    'Valor Atualizado': '2.240,00',
  }];
  const [pos] = parseB3Positions(rows);
  assert.equal(pos.type, 'fii');
});

test('parseB3Positions skips rows with zero quantity', () => {
  const rows = [{
    'Código de Negociação': 'ITSA4',
    'Tipo': 'Ação Ordinária',
    'Quantidade': '0',
    'Valor Atualizado': '0,00',
  }];
  assert.equal(parseB3Positions(rows).length, 0);
});

test('parseBRNumber handles Brazilian decimal format', () => {
  assert.equal(parseBRNumber('1.234,56'), 1234.56);
  assert.equal(parseBRNumber('100'), 100);
  assert.equal(parseBRNumber('1.050,00'), 1050);
});
