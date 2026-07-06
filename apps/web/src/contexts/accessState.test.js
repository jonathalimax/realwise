import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OWNER_EMAIL, deriveAccessState } from './accessState';

describe('deriveAccessState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns loading false and no owner when there is no authenticated user', () => {
    expect(deriveAccessState(null)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      hasPremiumAccess: false,
      ownerId: null,
      loading: false,
      premiumAccessEndsAt: null,
      premiumDaysRemaining: 0,
      premiumFeatureLocks: {
        bills: true,
        planning: true,
        investments: true,
        spendGuidance: true,
      },
      currentUser: null,
    });
  });

  it('marks the owner account as writable, owned, and premium-active when trialing is still valid', () => {
    const user = {
      sub: 'user-1',
      email: OWNER_EMAIL,
      role: 'user',
      premiumStatus: 'trialing',
      premiumAccessEndsAt: '2026-08-16T12:00:00.000Z',
    };

    expect(deriveAccessState(user)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: true,
      hasPremiumAccess: true,
      ownerId: 'user-1',
      loading: false,
      premiumAccessEndsAt: '2026-08-16T12:00:00.000Z',
      premiumDaysRemaining: 45,
      premiumFeatureLocks: {
        bills: false,
        planning: false,
        investments: false,
        spendGuidance: false,
      },
      currentUser: user,
    });
  });

  it('locks premium features after premium access expires while keeping core write access', () => {
    const user = {
      sub: 'user-2',
      email: 'guest@example.com',
      role: 'user',
      premiumStatus: 'expired',
      premiumAccessEndsAt: '2026-06-15T12:00:00.000Z',
    };

    expect(deriveAccessState(user)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      hasPremiumAccess: false,
      ownerId: 'user-2',
      loading: false,
      premiumAccessEndsAt: '2026-06-15T12:00:00.000Z',
      premiumDaysRemaining: 0,
      premiumFeatureLocks: {
        bills: true,
        planning: true,
        investments: true,
        spendGuidance: true,
      },
      currentUser: user,
    });
  });
});
