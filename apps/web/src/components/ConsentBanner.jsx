import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent } from '../lib/analyticsConsent';

export const CONSENT_REOPEN_EVENT = 'rw:consent-reopen';

/** Asks before Google Analytics is loaded. Shown on the public pages (site, login, legal) until the visitor answers. */
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const answer = (value) => {
    setAnalyticsConsent(value);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookies e privacidade"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:p-5"
    >
      <p className="text-sm leading-relaxed">
        Usamos o Google Analytics, que coloca cookies no seu navegador, para entender como o site é usado. Ele só é ativado se você aceitar.{' '}
        <a href="/privacidade#cookies" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          Saiba mais
        </a>
      </p>
      <div className="mt-3 flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => answer('denied')}
          className="h-10 flex-1 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800 sm:flex-none sm:px-5"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => answer('granted')}
          className="h-10 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex-none sm:px-5"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
