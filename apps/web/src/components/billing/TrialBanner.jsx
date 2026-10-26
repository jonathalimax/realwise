import { Link } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getBillingCopy } from './billingCopy';

// Only for the free trial: never for owner, lifetime or subscribed users.
export default function TrialBanner() {
  const { access } = useAccess();
  const { language } = useSettings();

  if (access?.state !== 'trial' || access.allowed !== true) return null;

  const copy = getBillingCopy(language).trial;
  const days = Math.max(0, access.trialDaysRemaining ?? 0);

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <span className="font-medium">{days > 0 ? copy.daysLeft(days) : copy.lastDay}</span>
      <Link
        to="/billing"
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-amber-900 px-3 text-sm font-semibold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
      >
        {copy.cta}
      </Link>
    </div>
  );
}
