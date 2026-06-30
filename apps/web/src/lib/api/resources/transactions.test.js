import { describe, expect, it, vi } from 'vitest';

import { createTransactionsResource, normalizeTransaction } from './transactions';

describe('normalizeTransaction', () => {
  it('converts numeric strings and null migrated categories into app-safe values', () => {
    expect(normalizeTransaction({
      id: 'tx-1',
      amount: '1443.00',
      category: null,
    })).toEqual({
      id: 'tx-1',
      amount: 1443,
      category: 'Sem categoria',
    });
  });
});

describe('createTransactionsResource', () => {
  it('lists, creates, updates, and deletes transactions through the API client', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ id: 'tx-1', amount: '10.50', category: null }]),
      post: vi.fn().mockResolvedValue({ id: 'tx-1', amount: '12.25', category: null }),
      patch: vi.fn().mockResolvedValue({ id: 'tx-1', description: 'Updated', amount: '13.75', category: null }),
      delete: vi.fn().mockResolvedValue(null),
    };

    const resource = createTransactionsResource({ client });

    const listResult = await resource.list({ month: '2026-06', type: 'expense' });
    const createResult = await resource.create({ description: 'Lunch' });
    const updateResult = await resource.update('tx-1', { description: 'Updated' });
    await resource.remove('tx-1');

    expect(client.get).toHaveBeenCalledWith('/transactions?month=2026-06&type=expense');
    expect(client.post).toHaveBeenCalledWith('/transactions', { description: 'Lunch' });
    expect(client.patch).toHaveBeenCalledWith('/transactions/tx-1', { description: 'Updated' });
    expect(client.delete).toHaveBeenCalledWith('/transactions/tx-1');
    expect(listResult[0]).toMatchObject({ amount: 10.5, category: 'Sem categoria' });
    expect(createResult).toMatchObject({ amount: 12.25, category: 'Sem categoria' });
    expect(updateResult).toMatchObject({ amount: 13.75, category: 'Sem categoria' });
  });
});
