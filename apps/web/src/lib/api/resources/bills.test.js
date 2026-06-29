import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBillsResource } from './bills';

describe('createBillsResource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads bills from /bills', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ id: 'bill-1' }]),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const resource = createBillsResource({ client });
    const result = await resource.list();

    expect(client.get).toHaveBeenCalledWith('/bills');
    expect(result).toEqual([{ id: 'bill-1' }]);
  });

  it('marks a bill as paid with the target occurrence and paid amount payload', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn().mockResolvedValue({ id: 'bill-1', status: 'paid' }),
      delete: vi.fn(),
    };

    const resource = createBillsResource({ client });
    const result = await resource.markPaid('bill-1', {
      paidDate: '2026-06-27T12:00:00.000Z',
      targetDueDate: '2026-07-10T00:00:00.000Z',
      paidAmount: '175.25',
    });

    expect(client.patch).toHaveBeenCalledWith('/bills/bill-1/mark-paid', {
      paidDate: '2026-06-27T12:00:00.000Z',
      targetDueDate: '2026-07-10T00:00:00.000Z',
      paidAmount: '175.25',
    });
    expect(result).toEqual({ id: 'bill-1', status: 'paid' });
  });
});
