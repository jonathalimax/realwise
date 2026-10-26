import type { users } from '../db/schema';

export const OWNER_EMAIL = 'jonathalimax@gmail.com';
export const PAST_DUE_GRACE_DAYS = 3;

export type AccessState = 'owner' | 'lifetime' | 'subscribed' | 'trial' | 'blocked';
export type BillingPlan = 'monthly' | 'annual';

export interface AccessInfo {
  state: AccessState;
  allowed: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  plan: BillingPlan | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
}

export type AccessUser = Pick<
  typeof users.$inferSelect,
  | 'email'
  | 'role'
  | 'premiumStatus'
  | 'premiumAccessEndsAt'
  | 'stripeCustomerId'
  | 'stripeSubscriptionId'
  | 'subscriptionStatus'
  | 'subscriptionPlan'
  | 'subscriptionCurrentPeriodEnd'
  | 'subscriptionCancelAtPeriodEnd'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function asPlan(value: string | null | undefined): BillingPlan | null {
  return value === 'monthly' || value === 'annual' ? value : null;
}

function isSubscribed(user: AccessUser, nowMs: number): boolean {
  const periodEndMs = user.subscriptionCurrentPeriodEnd?.getTime() ?? null;

  switch (user.subscriptionStatus) {
    case 'active':
    case 'trialing':
      return true;
    case 'past_due':
      // Grace window after a failed renewal; without a known period end we fail closed.
      return periodEndMs !== null && nowMs < periodEndMs + PAST_DUE_GRACE_DAYS * DAY_MS;
    case 'canceled':
      // Cancelled but already paid up to the end of the current period.
      return user.subscriptionCancelAtPeriodEnd && periodEndMs !== null && nowMs < periodEndMs;
    default:
      return false;
  }
}

const BLOCKED: AccessInfo = {
  state: 'blocked',
  allowed: false,
  trialEndsAt: null,
  trialDaysRemaining: 0,
  plan: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canManageBilling: false,
};

/**
 * Single source of truth for "can this user use the app". Pure: `now` is a parameter.
 * A missing user (`null`) is always blocked (fail closed).
 */
export function computeAccess(user: AccessUser | null, now: Date): AccessInfo {
  if (!user) return { ...BLOCKED };

  const nowMs = now.getTime();
  const trialEnd = user.premiumAccessEndsAt;
  const inTrial =
    user.premiumStatus === 'trialing' && trialEnd !== null && trialEnd.getTime() > nowMs;

  let state: AccessState;
  if (user.role === 'admin' || user.email.trim().toLowerCase() === OWNER_EMAIL) {
    state = 'owner';
  } else if (user.premiumStatus === 'active' && !user.stripeSubscriptionId) {
    state = 'lifetime';
  } else if (isSubscribed(user, nowMs)) {
    state = 'subscribed';
  } else if (inTrial) {
    state = 'trial';
  } else {
    state = 'blocked';
  }

  const hadTrial = user.premiumStatus === 'trialing' || user.premiumStatus === 'expired';
  const showTrialEnd = (state === 'trial' || state === 'blocked') && hadTrial && trialEnd !== null;

  return {
    state,
    allowed: state !== 'blocked',
    trialEndsAt: showTrialEnd ? trialEnd.toISOString() : null,
    trialDaysRemaining:
      state === 'trial' && trialEnd ? Math.ceil((trialEnd.getTime() - nowMs) / DAY_MS) : 0,
    plan: asPlan(user.subscriptionPlan),
    subscriptionStatus: user.subscriptionStatus ?? null,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
    canManageBilling: Boolean(user.stripeCustomerId),
  };
}

/** True while a Stripe subscription exists that Checkout must not duplicate. */
export function hasLiveSubscription(user: Pick<AccessUser, 'subscriptionStatus'>): boolean {
  return (
    user.subscriptionStatus === 'active'
    || user.subscriptionStatus === 'trialing'
    || user.subscriptionStatus === 'past_due'
    || user.subscriptionStatus === 'unpaid'
    || user.subscriptionStatus === 'paused'
  );
}
