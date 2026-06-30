import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccountsResource, normalizeAccount } from './accounts';

describe('normalizeAccount', () => {
  it('reconstructs migrated bank metadata from persisted fallback fields', () => {
    expect(normalizeAccount({
      id: 'acct-1',
      name: 'Nubank',
      type: 'credit',
      bankId: null,
      icon: 'nubank',
      cardName: null,
      customBankName: null,
      hasCredit: null,
      balance: '1500.50',
    })).toEqual({
      id: 'acct-1',
      name: 'Nubank',
      type: 'credit',
      bankId: 'nubank',
      icon: 'nubank',
      cardName: 'Nubank',
      customBankName: null,
      hasCredit: true,
      closingDay: null,
      paymentDay: null,
      balance: 1500.5,
    });
  });
});

describe('createAccountsResource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads accounts from /accounts', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ id: 'acct-1', name: 'Nubank', type: 'credit', bankId: null, icon: 'nubank', balance: '0' }]),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const resource = createAccountsResource({ client });
    const result = await resource.list();

    expect(client.get).toHaveBeenCalledWith('/accounts');
    expect(result).toEqual([{
      id: 'acct-1',
      name: 'Nubank',
      type: 'credit',
      bankId: 'nubank',
      icon: 'nubank',
      cardName: 'Nubank',
      customBankName: null,
      hasCredit: true,
      closingDay: null,
      paymentDay: null,
      balance: 0,
    }]);
  });

  it('creates an account with card fields', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ id: 'acct-1', name: 'Nubank', type: 'credit', bankId: 'nubank', cardName: 'Ultravioleta', hasCredit: true, closingDay: 10, paymentDay: 15, balance: '0' }),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const resource = createAccountsResource({ client });
    const payload = {
      name: 'Nubank',
      type: 'credit',
      bankId: 'nubank',
      cardName: 'Ultravioleta',
      hasCredit: true,
      closingDay: 10,
      paymentDay: 15,
    };

    const result = await resource.create(payload);

    expect(client.post).toHaveBeenCalledWith('/accounts', payload);
    expect(result).toEqual({
      id: 'acct-1',
      name: 'Nubank',
      type: 'credit',
      bankId: 'nubank',
      cardName: 'Ultravioleta',
      customBankName: null,
      hasCredit: true,
      closingDay: 10,
      paymentDay: 15,
      balance: 0,
    });
  });
});
