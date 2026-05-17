import { describe, it, expect, test } from 'vitest';
import { extractPattern } from './categorizationService';
import { categorizeTransaction } from '../constants/defaultCategorizationRules';

describe('extractPattern', () => {
  it('returns empty string for falsy input', () => {
    expect(extractPattern('')).toBe('');
    expect(extractPattern(null)).toBe('');
    expect(extractPattern(undefined)).toBe('');
  });

  it('normalizes to uppercase and removes accents', () => {
    const result = extractPattern('Pão de Açúcar');
    expect(result).toBe('PAO DE ACUCAR');
  });

  it('removes date patterns', () => {
    const result = extractPattern('MERCADO 12/03/2024');
    expect(result).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('removes installment indicators', () => {
    const result = extractPattern('NETFLIX PARCELA 1/12');
    expect(result).not.toMatch(/PARCELA \d+/i);
  });

  it('removes long numeric IDs anywhere in the string', () => {
    const result = extractPattern('PIX 123456789 MERCADO');
    expect(result).not.toMatch(/123456789/);
    expect(result).toContain('MERCADO');
  });

  it('removes UUID-like patterns', () => {
    const result = extractPattern('TRANSFER a1b2c3d4-e5f6-7890-abcd-ef1234567890 STORE');
    expect(result).not.toMatch(/[0-9A-F]{8}-/i);
    expect(result).toContain('STORE');
  });

  it('strips trailing city-state suffixes like "- CAMPINAS SP"', () => {
    const result = extractPattern('SUPERMERCADO ABC - CAMPINAS SP');
    expect(result).not.toMatch(/- CAMPINAS SP$/);
  });

  it('removes excessive whitespace', () => {
    const result = extractPattern('MERCADO   EXTRA');
    expect(result).toBe('MERCADO EXTRA');
  });
});

describe('extractPattern — noise removal improvements', () => {
  test('strips asterisk-prefixed short ID', () => {
    expect(extractPattern('PIX JOAO *12345 05/04')).toBe('PIX JOAO');
  });
  test('strips trailing 2-digit/2-digit date fragments', () => {
    expect(extractPattern('PIX JOAO 05/04')).toBe('PIX JOAO');
  });
  test('strips asterisk-prefixed alphanumeric merchant suffix', () => {
    expect(extractPattern('IFOOD*ABC123')).toBe('IFOOD');
  });
  test('strips transfer noise words at start', () => {
    expect(extractPattern('TRANSF PIX RESTAURANTE BOM')).toBe('PIX RESTAURANTE BOM');
  });
});

describe('categorizeTransaction returns null when no rule matches', () => {
  it('returns null for empty description', () => {
    expect(categorizeTransaction('')).toBeNull();
    expect(categorizeTransaction(null)).toBeNull();
  });

  it('returns null for a description with no matching keywords', () => {
    const result = categorizeTransaction('XYZZY FROBOZZ QUUX AAABBBCCC');
    expect(result).toBeNull();
  });

  it('returns a category object for a matching description', () => {
    const result = categorizeTransaction('NETFLIX');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('type');
    expect(result.confidence).toBe(1.0);
  });

  it('user rules with higher priority override defaults', () => {
    const userRule = {
      keywords: ['XYZZY'],
      category: 'Lazer',
      type: 'expense',
      priority: 20,
      isUserRule: true
    };
    const result = categorizeTransaction('XYZZY FROBOZZ', [userRule]);
    expect(result).not.toBeNull();
    expect(result.category).toBe('Lazer');
  });
});
