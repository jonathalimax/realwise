import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccountsResource } from './accounts';

describe('createAccountsResource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads accounts from /accounts', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ id: 'acct-1' }]),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const resource = createAccountsResource({ client });
    const result = await resource.list();

    expect(client.get).toHaveBeenCalledWith('/accounts');
    expect(result).toEqual([{ id: 'acct-1' }]);
  });

  it('creates an account with card fields', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ id: 'acct-1' }),
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
    expect(result).toEqual({ id: 'acct-1' });
  });
});
