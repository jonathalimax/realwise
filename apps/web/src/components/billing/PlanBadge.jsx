import { Link } from 'react-router-dom';
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
          className="mt-2 flex min-h-9 w-full items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white hover:bg-violet-700"
        >
          {c.subscribeNow}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{info.copy.settings.title}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">{info.title}</p>
      {info.detail && <p className={`text-[11px] ${info.warn ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>{info.detail}</p>}
    </div>
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
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
        >
          {c.subscribeNow}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      <span className="min-w-0 truncate">
        <strong className="font-bold text-gray-800 dark:text-gray-200">{info.title}</strong>
        {info.detail && <span className={info.warn ? ' font-semibold text-amber-600 dark:text-amber-400' : ''}> · {info.detail}</span>}
      </span>
      <Link to="/settings" className="shrink-0 font-semibold text-violet-600 hover:underline dark:text-violet-400">
        {c.manage}
      </Link>
    </div>
  );
}
