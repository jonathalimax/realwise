import { ChevronRightIcon } from '@heroicons/react/24/outline';

/** Shared shell for every Home card: small-caps label, one line of context, optional action. */
export default function HomeCard({ title, subtitle, actionLabel, onAction, children, className = '' }) {
  return (
    <section className={`w-full overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-bold text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/20"
          >
            {actionLabel}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
