import { useEffect } from 'react';
import { OPERATOR } from './operator';
import { CONSENT_REOPEN_EVENT } from '../../components/ConsentBanner';

/** Public page shell for the legal texts: no login, light/dark by system preference, readable on a phone. */
export default function LegalLayout({ title, updatedAt, intro, sections }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Realwise`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <header className="border-b border-[var(--rw-border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <a href="/" className="flex items-center gap-2.5 font-semibold text-[var(--rw-ink)]">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
            Realwise
          </a>
          <nav className="flex gap-4 text-sm text-[var(--rw-muted)]">
            <a href="/privacidade" className="hover:text-slate-900 dark:hover:text-white">Privacidade</a>
            <a href="/termos" className="hover:text-slate-900 dark:hover:text-white">Termos</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--rw-ink)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--rw-muted)]">Última atualização: {updatedAt}</p>
        {intro && <p className="mt-6 leading-relaxed">{intro}</p>}

        <nav aria-label="Índice" className="mt-8 rounded-2xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-semibold text-[var(--rw-ink)]">
              {i + 1}. {s.title}
            </h2>
            {s.body.map((block, j) =>
              Array.isArray(block) ? (
                <ul key={j} className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                  {block.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={j} className="mt-3 leading-relaxed">
                  {block}
                </p>
              ),
            )}
          </section>
        ))}

        <footer className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))}
            className="mb-3 block font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            Preferências de cookies
          </button>
          {OPERATOR.name} · CNPJ {OPERATOR.cnpj} ·{' '}
          <a href={`mailto:${OPERATOR.email}`} className="underline">
            {OPERATOR.email}
          </a>
        </footer>
      </main>
    </div>
  );
}
