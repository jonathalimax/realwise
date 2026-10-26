import { describe, expect, it } from 'vitest';
import { deriveAccessState } from './accessState';

describe('deriveAccessState', () => {
  it('returns loading false and no owner when there is no authenticated user', () => {
    expect(deriveAccessState(null)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      access: null,
      hasPremiumAccess: false,
      ownerId: null,
      loading: false,
      currentUser: null,
    });
  });

  it('reflects the access object returned by the API', () => {
    const access = { state: 'trial', allowed: true, trialDaysRemaining: 2 };
    const user = { sub: 'user-1', email: 'guest@example.com', access };

    expect(deriveAccessState(user)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      access,
      hasPremiumAccess: true,
      ownerId: 'user-1',
      loading: false,
      currentUser: user,
    });
  });

  it('marks the owner and withholds premium access when the API says blocked', () => {
    expect(deriveAccessState({ sub: 'a', access: { state: 'owner', allowed: true } }).isOwner).toBe(true);
    expect(deriveAccessState({ sub: 'b', access: { state: 'blocked', allowed: false } }).hasPremiumAccess).toBe(false);
  });
});
