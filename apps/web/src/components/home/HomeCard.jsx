/** Shared shell for every Home card: a plain bold title, an optional "Ver tudo" style link, then the content. */
export default function HomeCard({ title, subtitle, actionLabel, onAction, children, className = '' }) {
  return (
    <section className={`w-full overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60 ${className}`}>
      {title && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {onAction && (
            <button onClick={onAction} className="shrink-0 rounded-full px-1 py-0.5 text-base font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200">
              {actionLabel}
            </button>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
