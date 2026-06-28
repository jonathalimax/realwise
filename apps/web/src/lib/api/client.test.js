import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends credentials on GET requests and parses JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
      },
      json: async () => ({ ok: true }),
    }));

    const client = createApiClient({ baseUrl: 'http://localhost:3001' });
    const result = await client.get('/auth/me');

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('returns null for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      text: async () => '',
    }));

    const client = createApiClient();

    await expect(client.delete('/auth/logout')).resolves.toBeNull();
  });

  it('normalizes non-2xx responses into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      json: async () => ({ message: 'Unauthorized' }),
    }));

    const client = createApiClient();

    await expect(client.get('/auth/me')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 401,
        message: 'Unauthorized',
      }),
    );
  });

  it('sends JSON bodies for patch requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      json: async () => ({ ok: true }),
    }));

    const client = createApiClient({ baseUrl: 'http://localhost:3001' });
    await client.patch('/settings', { currency: 'BRL' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/settings',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ currency: 'BRL' }),
      }),
    );
  });
});

describe('ApiError', () => {
  it('stores response metadata for callers', () => {
    const err = new ApiError('Nope', { status: 400, data: { message: 'Nope' } });

    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(400);
    expect(err.data).toEqual({ message: 'Nope' });
  });
});
