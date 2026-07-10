import { beforeEach, describe, expect, it } from 'vitest';
import { clearLoginSession, isLoginSessionExpired, markLoginSession } from './sessionAge';

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
});

describe('login session age', () => {
  it('treats a missing marker as active and creates one', () => {
    expect(isLoginSessionExpired(1000)).toBe(false);
    expect(store.get('__rw_login_at')).toBe('1000');
  });

  it('keeps sessions active before 15 days', () => {
    markLoginSession(1000);
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;

    expect(isLoginSessionExpired(1000 + fourteenDays)).toBe(false);
  });

  it('expires sessions at 15 days', () => {
    markLoginSession(1000);
    const fifteenDays = 15 * 24 * 60 * 60 * 1000;

    expect(isLoginSessionExpired(1000 + fifteenDays)).toBe(true);
  });

  it('clears the marker on logout', () => {
    markLoginSession(1000);
    clearLoginSession();

    expect(store.has('__rw_login_at')).toBe(false);
  });
});
