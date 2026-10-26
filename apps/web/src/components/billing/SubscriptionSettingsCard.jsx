import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';
import { useSettings } from '../../contexts/SettingsContext';
import { billingResource } from '../../lib/api/resources/billing';
import { formatDate, getBillingCopy } from './billingCopy';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  );
}

export default function SubscriptionSettingsCard() {
  const { access } = useAccess();
  const { language } = useSettings();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const openingRef = useRef(false);

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

  const manage = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError('');
    try {
      const { url } = await billingResource.createPortal();
      if (!url) throw new Error('missing url');
      window.location.assign(url);
    } catch {
      openingRef.current = false;
      setOpening(false);
      setError(labels.paywall.portalError);
    }
  };

  return (
    <section
      aria-labelledby="subscription-heading"
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
    >
      <h2 id="subscription-heading" className="px-5 py-4 font-bold text-gray-900 dark:text-white">
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
      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-red-800 bg-red-50 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </p>
      )}

      {(access.canManageBilling || canSubscribe) && (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
          {canSubscribe && (
            <Link
              to="/billing"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 text-base font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {copy.subscribe}
            </Link>
          )}
          {access.canManageBilling && (
            <button
              type="button"
              onClick={manage}
              disabled={opening}
              className="min-h-11 rounded-xl border border-gray-300 px-5 text-base font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
            >
              {opening ? labels.paywall.opening : copy.manage}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
