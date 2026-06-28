import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthApi } from './auth';

describe('createAuthApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the expected auth endpoints', async () => {
    const calls = [];

    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      calls.push([url, options.method]);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
        },
        json: async () => ({ ok: true }),
      };
    }));

    const authApi = createAuthApi({ baseUrl: 'http://localhost:3001' });

    await authApi.getSession();
    await authApi.refresh();
    await authApi.logout();

    expect(calls).toEqual([
      ['http://localhost:3001/auth/me', 'GET'],
      ['http://localhost:3001/auth/refresh', 'POST'],
      ['http://localhost:3001/auth/logout', 'POST'],
    ]);
  });
});
