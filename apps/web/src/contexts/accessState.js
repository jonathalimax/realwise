export const OWNER_EMAIL = 'jonathalimax@gmail.com';

function buildPremiumFeatureLocks(hasPremiumAccess) {
  return {
    bills: !hasPremiumAccess,
    planning: !hasPremiumAccess,
    investments: !hasPremiumAccess,
    spendGuidance: !hasPremiumAccess,
  };
}

function derivePremiumAccess(currentUser) {
  const premiumAccessEndsAt = currentUser?.premiumAccessEndsAt ?? null;
  const premiumStatus = currentUser?.premiumStatus ?? null;
  const endsAtMs = premiumAccessEndsAt ? new Date(premiumAccessEndsAt).getTime() : Number.NaN;
  const hasValidEndDate = Number.isFinite(endsAtMs);
  const premiumDaysRemaining = hasValidEndDate
    ? Math.max(0, Math.ceil((endsAtMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const hasPremiumAccess =
    (premiumStatus === 'trialing' || premiumStatus === 'active') &&
    (!hasValidEndDate || endsAtMs >= Date.now());

  return {
    hasPremiumAccess,
    premiumAccessEndsAt,
    premiumDaysRemaining,
    premiumFeatureLocks: buildPremiumFeatureLocks(hasPremiumAccess),
  };
}

export function deriveAccessState(currentUser) {
  if (!currentUser) {
    return {
      userRole: 'write',
      canWrite: true,
      isReadOnly: false,
      isOwner: false,
      hasPremiumAccess: false,
      ownerId: null,
      loading: false,
      premiumAccessEndsAt: null,
      premiumDaysRemaining: 0,
      premiumFeatureLocks: buildPremiumFeatureLocks(false),
      currentUser: null,
    };
  }

  const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL;
  const userRole = 'write';
  const premiumAccess = derivePremiumAccess(currentUser);

  return {
    userRole,
    canWrite: true,
    isReadOnly: false,
    isOwner,
    ...premiumAccess,
    ownerId: currentUser.sub,
    loading: false,
    currentUser,
  };
}
