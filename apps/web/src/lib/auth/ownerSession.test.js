import { describe, expect, it } from 'vitest';
import { requireOwnerId } from './ownerSession';

describe('requireOwnerId', () => {
  it('returns the owner id when one is available', () => {
    expect(requireOwnerId('user-123')).toBe('user-123');
  });

  it('throws when the authenticated owner is missing', () => {
    expect(() => requireOwnerId(null)).toThrow('Authenticated owner is required');
  });
});
