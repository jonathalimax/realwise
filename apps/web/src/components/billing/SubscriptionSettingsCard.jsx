import { Link } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';
import { useSettings } from '../../contexts/SettingsContext';
import { formatDate, getBillingCopy } from './billingCopy';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-sm text-[var(--rw-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--rw-ink)] text-right">{value}</span>
    </div>
  );
}

export default function SubscriptionSettingsCard() {
  const { access } = useAccess();
  const { language } = useSettings();
  if (!access) return null;

  const labels = getBillingCopy(language);
  const copy = labels.settings;
  const stateLabel = {
    owner: copy.stateOwner,
    lifetime: copy.stateLifetime,
    subscribed: copy.stateSubscribed,
    trial: copy.stateTrial,
    blocked: copy.stateBlocked,
  }[access.state] ?? copy.stateBlocked;

  const planLabel = access.plan === 'annual' ? copy.annual : access.plan === 'monthly' ? copy.monthly : null;
  const periodEnd = formatDate(access.currentPeriodEnd, labels.locale);
  const trialEnd = formatDate(access.trialEndsAt, labels.locale);
  const isSubscribed = access.state === 'subscribed';
  const canSubscribe = access.state === 'trial' || access.state === 'blocked';

  return (
    <section
      aria-labelledby="subscription-heading"
      className="bg-[var(--rw-surface)] rounded-2xl border border-[var(--rw-border)] divide-y divide-[var(--rw-border)]"
    >
      <h2 id="subscription-heading" className="px-5 py-4 font-bold text-[var(--rw-ink)]">
        {copy.title}
      </h2>
      <Row label={copy.statusLabel} value={stateLabel} />
      {planLabel && <Row label={copy.planLabel} value={planLabel} />}
      {isSubscribed && periodEnd && (
        <Row label={access.cancelAtPeriodEnd ? copy.endsLabel : copy.renewsLabel} value={periodEnd} />
      )}
      {access.state === 'trial' && trialEnd && <Row label={copy.trialEndsLabel} value={trialEnd} />}

      {isSubscribed && access.cancelAtPeriodEnd && periodEnd && (
        <p className="px-5 py-3 text-sm text-amber-900 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-100">
          {copy.cancelNotice(periodEnd)}
        </p>
      )}
      {access.subscriptionStatus === 'past_due' && (
        <p className="px-5 py-3 text-sm text-amber-900 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-100">
          {copy.pastDue}
        </p>
      )}
      {(access.canManageBilling || canSubscribe) && (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
          {canSubscribe && (
            <Link
              to="/billing"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--rw-brand)] px-5 text-base font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {copy.subscribe}
            </Link>
          )}
          {access.canManageBilling && (
            <Link
              to="/subscription"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-5 text-base font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
            >
              {copy.manage}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
