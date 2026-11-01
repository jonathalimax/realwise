import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { billingResource } from '../../lib/api/resources/billing';
import { useAccess } from '../../contexts/AccessContext';
import { useAuth } from '../../contexts/AuthContext';
import { getBillingCopy, resolveBillingLanguage } from './billingCopy';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;
const DARK_MODE_STORAGE_KEY = 'realwise:darkMode';

// The Stripe webhook may land after the redirect (or not at all if it is misconfigured), so each poll first asks the
// server to re-read the subscription from Stripe, then reloads the user. The redirect itself is never trusted.
export default function BillingSuccessPage() {
  const { access } = useAccess();
  const { reloadUser } = useAuth();
  const sessionId = useSearchParams()[0].get('session_id') ?? undefined;
  const [copy] = useState(() => getBillingCopy(resolveBillingLanguage()));
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const allowed = access?.allowed === true;

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true');
    } catch {
      // storage unavailable: keep the current theme
    }
  }, []);

  useEffect(() => {
    if (allowed) return undefined;

    let active = true;
    let timer;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        await billingResource.sync(sessionId);
      } catch {
        // Stripe unreachable or nothing to sync yet: the webhook may still bring the state, keep polling
      }
      try {
        await reloadUser();
      } catch {
        // transient failure: keep polling until the timeout
      }
      if (!active) return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [allowed, reloadUser, sessionId, attempt]);

  const retry = useCallback(() => {
    setTimedOut(false);
    setAttempt((value) => value + 1);
  }, []);

  if (allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
        {!timedOut && (
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-b-2 border-violet-500" aria-hidden="true" />
        )}
        <h1 className="text-2xl font-black" role="status">
          {timedOut ? copy.success.timeoutTitle : copy.success.confirmingTitle}
        </h1>
        <p className="mt-3 text-sm text-[var(--rw-muted)]">
          {timedOut ? copy.success.timeoutBody : copy.success.confirmingBody}
        </p>
        {timedOut && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={retry}
              className="min-h-12 rounded-2xl bg-[var(--rw-brand)] px-6 text-base font-bold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {copy.success.refresh}
            </button>
            <Link
              to="/billing"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-base font-medium text-gray-600 underline underline-offset-4 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-gray-300 dark:hover:text-white"
            >
              {copy.success.toPaywall}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
