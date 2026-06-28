export const OWNER_EMAIL = 'jonathalimax@gmail.com';

export function deriveAccessState(currentUser) {
  if (!currentUser) {
    return {
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      ownerId: null,
      loading: false,
      currentUser: null,
    };
  }

  const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL;
  const userRole = 'write';

  return {
    userRole,
    canWrite: true,
    isReadOnly: false,
    isOwner,
    ownerId: currentUser.sub,
    loading: false,
    currentUser,
  };
}
