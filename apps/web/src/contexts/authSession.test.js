import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAuthSession, logoutAuthSession, normalizeAuthenticatedUser } from './authSession';

describe('normalizeAuthenticatedUser', () => {
  it('adds Firebase-compatible aliases to the API session payload', () => {
    expect(normalizeAuthenticatedUser({
      sub: 'u1',
      name: 'Jane Doe',
      email: 'jane@example.com',
    })).toEqual({
      sub: 'u1',
      uid: 'u1',
      name: 'Jane Doe',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
    });
  });
});

describe('bootstrapAuthSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an authenticated session when /auth/me succeeds', async () => {
    const authClient = {
      getSession: vi.fn().mockResolvedValue({ sub: 'u1', clientId: 'jonathalimax', role: 'user' }),
      logout: vi.fn(),
    };

    const result = await bootstrapAuthSession({
      authClient,
      isExpired: () => false,
      markSessionAge: vi.fn(),
    });

    expect(authClient.getSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'authenticated',
      user: {
        sub: 'u1',
        uid: 'u1',
        clientId: 'jonathalimax',
        role: 'user',
        displayName: null,
      },
    });
  });

  it('logs out expired sessions and returns unauthenticated state', async () => {
    const authClient = {
      getSession: vi.fn().mockResolvedValue({ sub: 'u1', clientId: 'jonathalimax', role: 'user' }),
      logout: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await bootstrapAuthSession({
      authClient,
      isExpired: () => true,
      clearSessionAge: vi.fn(),
    });

    expect(authClient.logout).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'unauthenticated',
      user: null,
    });
  });

  it('returns unauthenticated state on 401 responses', async () => {
    const authClient = {
      getSession: vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' }),
      logout: vi.fn(),
    };

    const result = await bootstrapAuthSession({
      authClient,
      isExpired: () => false,
    });

    expect(result).toEqual({
      status: 'unauthenticated',
      user: null,
    });
  });
});

describe('logoutAuthSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the API logout and clears session age bookkeeping', async () => {
    const clearSessionAge = vi.fn();
    const authClient = {
      logout: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await logoutAuthSession({
      authClient,
      clearSessionAge,
    });

    expect(authClient.logout).toHaveBeenCalledTimes(1);
    expect(clearSessionAge).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'unauthenticated',
      user: null,
    });
  });
});
