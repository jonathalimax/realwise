// Entitlement is decided by the API (`access` inside GET /auth/me); this only reflects it.
// A missing `access` (older API) is treated as "not blocked": the server still enforces it.
export function deriveAccessState(currentUser) {
  if (!currentUser) {
    return {
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      access: null,
      hasPremiumAccess: false,
      ownerId: null,
      loading: false,
      currentUser: null,
    };
  }

  const access = currentUser.access ?? null;

  return {
    userRole: 'write',
    canWrite: true,
    isReadOnly: false,
    isOwner: access?.state === 'owner',
    access,
    hasPremiumAccess: access?.allowed === true,
    ownerId: currentUser.sub,
    loading: false,
    currentUser,
  };
}
