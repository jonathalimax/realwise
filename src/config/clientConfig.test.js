import { describe, it, expect } from 'vitest';
import { extractClientId } from './clientConfig';

describe('extractClientId', () => {
  it('extracts first segment from a nested path', () => {
    expect(extractClientId('/clienta/dashboard')).toBe('clienta');
  });

  it('extracts first segment from a top-level client path', () => {
    expect(extractClientId('/clienta')).toBe('clienta');
  });

  it('returns app when path is root', () => {
    expect(extractClientId('/')).toBe('app');
  });

  it('returns app when path is empty string', () => {
    expect(extractClientId('')).toBe('app');
  });

  it('returns app when first segment is a known non-client path', () => {
    expect(extractClientId('/__/auth/handler')).toBe('app');
  });
});
