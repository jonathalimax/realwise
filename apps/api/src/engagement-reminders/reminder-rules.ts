import { AccessInfo } from '../billing/access';

export type ReminderKind = 'trial_import' | 'trial_ending' | 'trial_expired' | 'monthly_import' | 'bill_suggestion';

export interface ReminderFacts {
  access: AccessInfo;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  transactionCount: number;
  /** Transactions created since the 1st of the current month. */
  transactionsThisMonth: number;
  now: Date;
}

const HOUR_MS = 3_600_000;

/**
 * Pure decision: which reminder (if any) is due for this user today.
 * At most one kind is returned, in priority order, so nobody gets two emails in one run.
 * `period_key` for the dedup table is derived by the caller per kind.
 */
export function pickReminder(f: ReminderFacts): ReminderKind | null {
  const { access, now } = f;
  const nowMs = now.getTime();

  if (access.state === 'trial' && f.trialEndsAt) {
    const left = f.trialEndsAt.getTime() - nowMs;
    if (left <= 24 * HOUR_MS) return 'trial_ending';
    const sinceStart = f.trialStartedAt ? nowMs - f.trialStartedAt.getTime() : 0;
    if (f.transactionCount === 0 && sinceStart >= 20 * HOUR_MS) return 'trial_import';
    return null;
  }

  if (access.state === 'blocked' && f.trialEndsAt) {
    const since = nowMs - f.trialEndsAt.getTime();
    if (since >= 0 && since <= 72 * HOUR_MS && !access.subscriptionStatus) return 'trial_expired';
    return null;
  }

  // Paying (or lifetime) users: a nudge on the 5th when statements are out and nothing was imported this month.
  if ((access.state === 'subscribed' || access.state === 'lifetime') && now.getDate() >= 5) {
    if (f.transactionsThisMonth === 0) return 'monthly_import';
  }
  return null;
}

export function periodKeyFor(kind: ReminderKind, now: Date, trialEndsAt: Date | null, suggestionId?: string): string {
  if (kind === 'bill_suggestion') return suggestionId ?? 'none';
  if (kind === 'monthly_import') return now.toISOString().slice(0, 7);
  return trialEndsAt ? trialEndsAt.toISOString().slice(0, 10) : 'once';
}
