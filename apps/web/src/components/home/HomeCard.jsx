/** Shared shell for every Home card: a plain bold title, an optional "Ver tudo" style link, then the content. */
export default function HomeCard({ title, subtitle, actionLabel, onAction, children, className = '' }) {
  return (
    <section className={`w-full overflow-hidden rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)] p-4 ${className}`}>
      {title && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold leading-6 text-[var(--rw-ink)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[15px] leading-snug text-[var(--rw-muted)]">{subtitle}</p>}
          </div>
          {onAction && (
            <button onClick={onAction} className="shrink-0 min-h-[44px] -mt-2 px-1 text-sm font-semibold text-[var(--rw-brand-ink)]">
              {actionLabel}
            </button>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
