import { useEffect, useState } from 'react';
import { useAccess } from '../../contexts/AccessContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getBillingCopy } from './billingCopy';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Re-renders every second while `active`, so a countdown ticks without any server call. */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const pad = (n) => String(n).padStart(2, '0');

function formatRemaining(ms, c) {
  const total = Math.max(0, ms);
  const d = Math.floor(total / DAY);
  const h = Math.floor((total % DAY) / HOUR);
  const m = Math.floor((total % HOUR) / MINUTE);
  const s = Math.floor((total % MINUTE) / SECOND);
  return d > 0 ? `${d}${c.d} ${pad(h)}${c.h} ${pad(m)}${c.m} ${pad(s)}${c.s}` : `${pad(h)}${c.h} ${pad(m)}${c.m} ${pad(s)}${c.s}`;
}

/** What to show for the current user's plan; null while loading or when there is no active access (the paywall shows then). */
export function usePlanInfo() {
  const { access } = useAccess();
  const { language } = useSettings();
  const copy = getBillingCopy(language);
  const c = copy.plan;
  const trialEnds = access?.state === 'trial' && access.trialEndsAt ? new Date(access.trialEndsAt).getTime() : null;
  const now = useNow(trialEnds !== null);

  if (!access || access.allowed !== true) return { kind: null, copy };

  const date = (iso) => (iso ? new Date(iso).toLocaleDateString(copy.locale) : '');
  if (access.state === 'trial' && trialEnds !== null) {
    const left = trialEnds - now;
    return {
      kind: 'trial',
      copy,
      title: c.trialLabel,
      countdown: left > 0 ? formatRemaining(left, c) : c.ended,
      // Under 24h left: the urgent (red) look.
      urgent: left < DAY,
    };
  }
  if (access.state === 'subscribed') {
    const planName = access.plan === 'annual' ? c.planAnnual : access.plan === 'monthly' ? c.planMonthly : c.planActive;
    let detail = access.currentPeriodEnd ? c.renewsOn(date(access.currentPeriodEnd)) : '';
    if (access.cancelAtPeriodEnd && access.currentPeriodEnd) detail = c.cancelsOn(date(access.currentPeriodEnd));
    if (access.subscriptionStatus === 'past_due') detail = c.pastDue;
    return { kind: 'paid', copy, title: planName, detail, warn: access.cancelAtPeriodEnd || access.subscriptionStatus === 'past_due' };
  }
  if (access.state === 'lifetime') return { kind: 'paid', copy, title: c.lifetime, detail: '' };
  if (access.state === 'owner') return { kind: 'paid', copy, title: c.owner, detail: '' };
  return { kind: null, copy };
}
