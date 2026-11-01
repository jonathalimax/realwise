import { Link } from 'react-router-dom';
import { ChevronRight, Crown } from 'lucide-react';
import { usePlanInfo } from './usePlanInfo';

/** Card for the side menu: plan name, and for the trial a live countdown with a subscribe button. */
export function PlanBadge({ onNavigate }) {
  const info = usePlanInfo();
  if (!info.kind) return null;
  const c = info.copy.plan;

  if (info.kind === 'trial') {
    return (
      <div
        role="status"
        className={`mx-4 mb-3 rounded-2xl border p-3 ${
          info.urgent
            ? 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30'
            : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
        }`}
      >
        <p className={`text-[10px] font-black uppercase tracking-widest ${info.urgent ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
          {info.title} · {c.endsIn}
        </p>
        <p className={`mt-1 text-lg font-black tabular-nums ${info.urgent ? 'text-rose-900 dark:text-rose-100' : 'text-amber-900 dark:text-amber-100'}`}>{info.countdown}</p>
        <Link
          to="/billing"
          onClick={onNavigate}
          className="mt-2 flex min-h-9 w-full items-center justify-center rounded-lg bg-[var(--rw-brand)] text-sm font-bold text-white hover:bg-violet-700"
        >
          {c.subscribeNow}
        </Link>
      </div>
    );
  }

  return (
    <Link
      to="/subscription"
      onClick={onNavigate}
      className="mx-4 mb-3 block rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-3 text-white shadow-lg shadow-violet-600/20 ring-1 ring-white/10 transition hover:brightness-110"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-200">
        <Crown className="h-3.5 w-3.5" /> {c.fullAccess}
      </p>
      <p className="mt-1 text-sm font-bold">{info.title}</p>
      {info.detail && <p className={`text-[11px] ${info.warn ? 'font-semibold text-amber-200' : 'text-white/70'}`}>{info.detail}</p>}
      <p className="mt-2 flex items-center gap-0.5 text-[11px] font-semibold text-white/90">
        {c.manage} <ChevronRight className="h-3.5 w-3.5" />
      </p>
    </Link>
  );
}

/** Strip at the top of every page: trial countdown (urgent under 24h) or the plan in use. */
export function PlanBar() {
  const info = usePlanInfo();
  if (!info.kind) return null;
  const c = info.copy.plan;

  if (info.kind === 'trial') {
    return (
      <div
        role="status"
        className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${
          info.urgent
            ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
        }`}
      >
        <span className="min-w-0 font-medium">
          {info.urgent && <span aria-hidden className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500 align-middle" />}
          {info.title} {c.endsIn} <strong className="tabular-nums">{info.countdown}</strong>
        </span>
        <Link
          to="/billing"
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--rw-brand)] px-3 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
        >
          {c.subscribeNow}
        </Link>
      </div>
    );
  }

  return (
    <Link
      to="/subscription"
      className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 px-4 py-2 text-white transition hover:brightness-110"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 text-amber-300" />
        <span className="shrink-0 text-sm font-bold">{c.fullAccess}</span>
        <span className="truncate text-xs text-white/75">
          {info.title}
          {info.detail && <span className={info.warn ? 'font-semibold text-amber-200' : ''}> · {info.detail}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-white/90">
        {c.manage} <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
