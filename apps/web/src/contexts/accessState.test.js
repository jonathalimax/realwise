import { describe, expect, it } from 'vitest';
import { OWNER_EMAIL, deriveAccessState } from './accessState';

describe('deriveAccessState', () => {
  it('returns loading false and no owner when there is no authenticated user', () => {
    expect(deriveAccessState(null)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      ownerId: null,
      loading: false,
      currentUser: null,
    });
  });

  it('marks the owner account as writable and owned', () => {
    const user = { sub: 'user-1', email: OWNER_EMAIL, role: 'user' };

    expect(deriveAccessState(user)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: true,
      ownerId: 'user-1',
      loading: false,
      currentUser: user,
    });
  });

  it('uses the authenticated user id as ownerId for non-owner accounts', () => {
    const user = { sub: 'user-2', email: 'guest@example.com', role: 'user' };

    expect(deriveAccessState(user)).toEqual({
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      ownerId: 'user-2',
      loading: false,
      currentUser: user,
    });
  });
});
