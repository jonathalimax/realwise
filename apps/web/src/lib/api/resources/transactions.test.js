import { describe, expect, it, vi } from 'vitest';

import { createTransactionsResource } from './transactions';

describe('createTransactionsResource', () => {
  it('lists, creates, updates, and deletes transactions through the API client', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({ id: 'tx-1' }),
      patch: vi.fn().mockResolvedValue({ id: 'tx-1', description: 'Updated' }),
      delete: vi.fn().mockResolvedValue(null),
    };

    const resource = createTransactionsResource({ client });

    await resource.list({ month: '2026-06', type: 'expense' });
    await resource.create({ description: 'Lunch' });
    await resource.update('tx-1', { description: 'Updated' });
    await resource.remove('tx-1');

    expect(client.get).toHaveBeenCalledWith('/transactions?month=2026-06&type=expense');
    expect(client.post).toHaveBeenCalledWith('/transactions', { description: 'Lunch' });
    expect(client.patch).toHaveBeenCalledWith('/transactions/tx-1', { description: 'Updated' });
    expect(client.delete).toHaveBeenCalledWith('/transactions/tx-1');
  });
});
