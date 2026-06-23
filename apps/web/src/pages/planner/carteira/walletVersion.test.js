import { describe, it, expect } from 'vitest';
import { getActiveVersionOrLatest } from './walletVersion';

describe('getActiveVersionOrLatest', () => {
  const v = (from) => ({ from, layers: [] });

  it('returns null for empty list', () => {
    expect(getActiveVersionOrLatest([], '2026-06')).toBeNull();
  });
  it('returns the active version when one matches the month', () => {
    expect(getActiveVersionOrLatest([v('2026-01'), v('2026-05')], '2026-06').from).toBe('2026-05');
  });
  it('falls back to the latest version when all versions are in the future', () => {
    expect(getActiveVersionOrLatest([v('2026-07'), v('2026-09')], '2026-06').from).toBe('2026-09');
  });
});
