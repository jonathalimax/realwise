import { describe, it, expect } from 'vitest';
import { categorizeParsedTransactions } from '../index';

describe('categorizeParsedTransactions', () => {
  it('preserves a category explicitly set by a parser instead of overwriting it via keyword rules', async () => {
    const transactions = [
      {
        date: new Date(2026, 7, 5).toISOString(),
        amount: 25.5,
        type: 'income',
        description: 'Cashback compra internacional',
        originalId: '',
        category: 'Investimentos',
      },
    ];

    const [result] = await categorizeParsedTransactions(transactions, null, {});

    // Without the fix, the shared "Reembolso" rule matches the CASHBACK keyword
    // and would overwrite this to 'Reembolso'.
    expect(result.category).toBe('Investimentos');
    expect(result.autoCategory).toBe(true);
    expect(!!result.needsAI).toBe(false);
  });

  it('still categorizes transactions without a pre-set category via the rule engine', async () => {
    const transactions = [
      {
        date: new Date(2026, 7, 10).toISOString(),
        amount: 150,
        type: 'expense',
        description: 'Pix enviado Maria Silva',
        originalId: '',
      },
    ];

    const [result] = await categorizeParsedTransactions(transactions, null, {});

    expect(result.category).toBeDefined();
    expect(result.category).not.toBe('');
  });
});
