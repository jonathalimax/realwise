import { AccessInfo } from '../billing/access';
import type { EngagementKind } from '../app-settings/app-settings.types';

export type ReminderKind = EngagementKind;

export interface ReminderFacts {
  access: AccessInfo;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  transactionCount: number;
  /** Transactions created since the 1st of the current month. */
  transactionsThisMonth: number;
  /** The user wrote to Elio in the last 24h: they are engaged right now, so a nudge would only be noise. */
  chattedRecently?: boolean;
  /** When paid access (or the trial) ended; basis of the win-back series. Null when unknown. */
  lostAt?: Date | null;
  /** The "add to your home screen" e-mail already went out (it is sent once per person). */
  installAppSent?: boolean;
  now: Date;
}

const HOUR_MS = 3_600_000;

/** Tuesday to Thursday in Brasilia time: the install e-mail is read on the phone and needs a few quiet minutes. */
function isMidweekInBrasilia(now: Date): boolean {
  const day = new Date(now.getTime() - 3 * HOUR_MS).getUTCDay();
  return day >= 2 && day <= 4;
}

/** Someone who already added something is worth an "install the app" nudge; sent once, never on a Monday or a weekend. */
function installAppDue(f: ReminderFacts, sinceStartMs: number | null): boolean {
  if (f.installAppSent || f.transactionCount === 0 || !isMidweekInBrasilia(f.now)) return false;
  return sinceStartMs === null || sinceStartMs >= 48 * HOUR_MS;
}

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
    // Activation series for people who signed up but never added anything: day 1, day 3 and day 5 of the trial.
    // Each kind is sent once (the window only decides which one is due), then trial_ending closes the series.
    if (f.transactionCount === 0 && !f.chattedRecently && f.trialStartedAt) {
      const sinceStart = nowMs - f.trialStartedAt.getTime();
      if (sinceStart >= 120 * HOUR_MS) return 'activation_day5';
      if (sinceStart >= 72 * HOUR_MS) return 'activation_day3';
      if (sinceStart >= 24 * HOUR_MS) return 'activation_day1';
    }
    if (f.trialStartedAt && installAppDue(f, nowMs - f.trialStartedAt.getTime())) return 'install_app';
    return null;
  }

  if (access.state === 'blocked') {
    if (f.trialEndsAt && !access.subscriptionStatus) {
      const since = nowMs - f.trialEndsAt.getTime();
      if (since >= 0 && since <= 72 * HOUR_MS) return 'trial_expired';
    }
    // Win-back: one e-mail per window (a week, a month, two months after leaving), then silence after four months.
    if (f.lostAt) {
      const days = (nowMs - f.lostAt.getTime()) / (24 * HOUR_MS);
      if (days >= 60 && days <= 120) return 'winback_60';
      if (days >= 30 && days < 60) return 'winback_30';
      if (days >= 7 && days < 30) return 'winback_7';
    }
    return null;
  }

  // Past due: the failed-charge e-mail already went out; remind once when the grace period is about to run out.
  if (access.state === 'subscribed' && access.subscriptionStatus === 'past_due' && access.currentPeriodEnd) {
    if (nowMs - new Date(access.currentPeriodEnd).getTime() >= 48 * HOUR_MS) return 'payment_failed_followup';
    return null;
  }

  // Paying (or lifetime) users: a nudge on the 5th when statements are out and nothing was imported this month.
  if ((access.state === 'subscribed' || access.state === 'lifetime') && now.getDate() >= 5) {
    if (f.transactionsThisMonth === 0) return 'monthly_import';
  }
  if ((access.state === 'subscribed' || access.state === 'lifetime') && installAppDue(f, null)) return 'install_app';
  return null;
}

export function periodKeyFor(kind: ReminderKind, now: Date, trialEndsAt: Date | null, suggestionId?: string, periodEnd?: string | null): string {
  if (kind === 'bill_suggestion') return suggestionId ?? 'none';
  if (kind === 'payment_failed_followup') return (periodEnd ?? '').slice(0, 10) || 'once';
  if (kind.startsWith('winback_')) return 'once';
  if (kind === 'monthly_import') return now.toISOString().slice(0, 7);
  if (kind === 'welcome' || kind === 'install_app' || kind.startsWith('activation_')) return 'once';
  return trialEndsAt ? trialEndsAt.toISOString().slice(0, 10) : 'once';
}
