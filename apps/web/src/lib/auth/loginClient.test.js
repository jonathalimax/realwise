import { describe, expect, it } from 'vitest';
import { buildLoginRedirectUrl, extractClientIdFromPathname, resolveLoginClientId } from './loginClient';

describe('loginClient', () => {
  it('extracts tenant ids from tenant routes', () => {
    expect(extractClientIdFromPathname('/jonathalimax/dashboard')).toBe('jonathalimax');
  });

  it('ignores reserved top-level routes', () => {
    expect(extractClientIdFromPathname('/login')).toBe('');
    expect(extractClientIdFromPathname('/admin')).toBe('');
  });

  it('prefers query clientId over path and stored client', () => {
    expect(resolveLoginClientId({
      search: '?clientId=jonathalimax',
      pathname: '/other/dashboard',
      storedClientId: 'fallback',
    })).toBe('jonathalimax');
  });

  it('builds a login redirect that preserves tenant context', () => {
    expect(buildLoginRedirectUrl('/jonathalimax/import', '')).toBe('/login?clientId=jonathalimax');
    expect(buildLoginRedirectUrl('/login', 'jonathalimax')).toBe('/login?clientId=jonathalimax');
    expect(buildLoginRedirectUrl('/login', '')).toBe('/login');
  });
});
