import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../contexts/AccessContext';
import { billingResource } from '../../lib/api/resources/billing';
import { logoutAndRedirect } from '../../lib/auth/logout';
import { formatMoney, getBillingCopy, resolveBillingLanguage } from './billingCopy';

const DARK_MODE_STORAGE_KEY = 'realwise:darkMode';
const PLAN_ORDER = ['annual', 'monthly'];

// SettingsProvider (which normally applies the theme) is not mounted while the app is blocked.
function useStoredTheme() {
  useEffect(() => {
    let dark = false;
    try {
      dark = localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
    } catch {
      // storage unavailable: keep the light theme
    }
    document.documentElement.classList.toggle('dark', dark);
  }, []);
}

function PlanOption({ plan, copy, selected, disabled, onSelect }) {
  const isAnnual = plan.plan === 'annual';
  const label = isAnnual ? copy.paywall.planAnnual : copy.paywall.planMonthly;
  const price = formatMoney(plan.amount, plan.currency, copy.locale);

  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name="plan"
        value={plan.plan}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(plan.plan)}
        className="peer sr-only"
      />
      <span
        className="block rounded-2xl border-2 border-gray-200 bg-white p-4 transition-colors peer-checked:border-violet-500 peer-checked:bg-violet-50 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:peer-checked:border-violet-400 dark:peer-checked:bg-violet-900/20 dark:peer-focus-visible:ring-offset-gray-900"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
          {isAnnual && plan.savingsPercent ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {copy.paywall.savings(plan.savingsPercent)}
            </span>
          ) : null}
        </span>
        <span className="mt-2 block text-2xl font-black text-gray-900 dark:text-white">
          {price}
          <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            {isAnnual ? copy.paywall.perYear : copy.paywall.perMonth}
          </span>
        </span>
        {isAnnual && (
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            {copy.paywall.perMonthEquivalent(formatMoney(Math.round(plan.amount / 12), plan.currency, copy.locale))}
          </span>
        )}
        <span className="mt-0.5 block text-xs font-semibold text-violet-600 dark:text-violet-300">
          {copy.paywall.perDayEquivalent(formatMoney(Math.round(plan.amount / (isAnnual ? 365 : 30)), plan.currency, copy.locale))}
        </span>
      </span>
    </label>
  );
}

export default function PaywallPage() {
  useStoredTheme();
  const { access } = useAccess();
  const [language] = useState(resolveBillingLanguage);
  const copy = getBillingCopy(language);

  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState(false);
  const [selected, setSelected] = useState(null);
  // 'checkout' | 'portal' | null: one redirecting action at a time (double-click safe)
  const [busy, setBusy] = useState(null);
  const busyRef = useRef(null);
  const [actionError, setActionError] = useState('');

  const fetchPlans = useCallback(() => {
    billingResource.listPlans()
      .then((rows) => {
        const sorted = [...(Array.isArray(rows) ? rows : [])]
          .filter((row) => PLAN_ORDER.includes(row.plan))
          .sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
        setPlans(sorted);
        setSelected((current) => current ?? (sorted.find((row) => row.plan === 'annual') ?? sorted[0])?.plan ?? null);
        if (sorted.length === 0) setPlansError(true);
      })
      .catch(() => setPlansError(true));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const retryPlans = () => {
    setPlansError(false);
    setPlans(null);
    fetchPlans();
  };

  // Coming back from Stripe with the back button restores this page from the bfcache with the busy state still set.
  useEffect(() => {
    const onPageShow = (event) => {
      if (event.persisted) {
        busyRef.current = null;
        setBusy(null);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const redirectTo = async (kind, request, fallbackError) => {
    if (busyRef.current) return;
    busyRef.current = kind;
    setBusy(kind);
    setActionError('');
    try {
      const { url } = await request();
      if (!url) throw new Error('missing url');
      window.location.assign(url);
    } catch (error) {
      busyRef.current = null;
      setBusy(null);
      setActionError(error?.status === 409 ? copy.paywall.alreadySubscribed : fallbackError);
    }
  };

  const subscribe = () => {
    if (!selected) return;
    redirectTo('checkout', () => billingResource.createCheckout(selected), copy.paywall.checkoutError);
  };

  const manage = () => redirectTo('portal', () => billingResource.createPortal(), copy.paywall.portalError);

  const isBlocked = access?.allowed === false;
  const title = !isBlocked
    ? copy.paywall.titleChoose
    : access?.subscriptionStatus
      ? copy.paywall.titleLapsed
      : copy.paywall.titleTrialEnded;
  const selectedPlan = plans?.find((row) => row.plan === selected);
  const selectedLabel = selected === 'annual' ? copy.paywall.planAnnual : copy.paywall.planMonthly;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-white sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl object-contain" />
          <span className="text-lg font-black uppercase tracking-tighter">Realwise</span>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
            {copy.paywall.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1>
          {isBlocked && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
              {copy.paywall.reassurance}
            </p>
          )}
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{copy.paywall.intro}</p>

          <div className="mt-6">
            {plans === null && !plansError && (
              <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{copy.paywall.plansLoading}</p>
            )}

            {plansError && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                <p>{copy.paywall.plansError}</p>
                <button
                  type="button"
                  onClick={retryPlans}
                  className="mt-3 min-h-11 rounded-xl bg-gray-900 px-4 text-base font-semibold text-white hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {copy.paywall.retry}
                </button>
              </div>
            )}

            {plans && plans.length > 0 && (
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">{copy.paywall.titleChoose}</legend>
                {plans.map((plan) => (
                  <PlanOption
                    key={plan.plan}
                    plan={plan}
                    copy={copy}
                    selected={selected === plan.plan}
                    disabled={busy !== null}
                    onSelect={setSelected}
                  />
                ))}
              </fieldset>
            )}
          </div>

          {actionError && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {actionError}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={subscribe}
              disabled={!selectedPlan || busy !== null}
              aria-busy={busy === 'checkout'}
              className="min-h-12 rounded-2xl bg-violet-600 px-6 text-base font-bold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-gray-800"
            >
              {busy === 'checkout' ? copy.paywall.redirecting : selectedPlan ? copy.paywall.subscribeWith(selectedLabel) : copy.paywall.subscribe}
            </button>

            {access?.canManageBilling && (
              <button
                type="button"
                onClick={manage}
                disabled={busy !== null}
                className="min-h-12 rounded-2xl border border-gray-300 px-6 text-base font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
              >
                {busy === 'portal' ? copy.paywall.opening : copy.paywall.manage}
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{copy.paywall.secureNote}</p>
        </div>

        <div className="mt-6 flex justify-center">
          {isBlocked ? (
            <button
              type="button"
              onClick={logoutAndRedirect}
              className="min-h-11 rounded-xl px-4 text-base font-medium text-gray-600 underline underline-offset-4 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-gray-300 dark:hover:text-white"
            >
              {copy.paywall.logout}
            </button>
          ) : (
            <Link
              to="/dashboard"
              className="inline-flex min-h-11 items-center rounded-xl px-4 text-base font-medium text-gray-600 underline underline-offset-4 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-gray-300 dark:hover:text-white"
            >
              {copy.paywall.backToApp}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
