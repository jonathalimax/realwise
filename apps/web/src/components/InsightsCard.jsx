import { useEffect, useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';
import { chatResource } from '../lib/api/resources/chat';
import { subscribeTransactionsChanged } from '../lib/api/resources/transactions';

const TONE = {
  positive: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200',
  warning: 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200',
  neutral: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
};

/** AI-written insight cards for the selected month. Renders nothing if the assistant is unavailable or there is no data. */
export default function InsightsCard({ selectedMonth }) {
  const { language } = useSettings();
  // Result is tagged with the request it answers, so "loading" is derived rather than set in the effect.
  const [result, setResult] = useState({ key: '', items: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeTransactionsChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let active = true;
    const key = `${selectedMonth}:${version}`;
    chatResource
      .insights(selectedMonth)
      .then((res) => active && setResult({ key, items: Array.isArray(res?.items) ? res.items : [] }))
      .catch(() => active && setResult({ key, items: [] }));
    return () => {
      active = false;
    };
  }, [selectedMonth, version]);

  const items = result.key === `${selectedMonth}:${version}` ? result.items : null;
  if (items && items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-4">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white mb-3">
        <SparklesIcon className="w-5 h-5 text-violet-500" />
        {language === 'pt' ? 'Insights do mês' : 'Monthly insights'}
      </h2>
      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-3" role="status" aria-busy="true">
          <span className="sr-only">{language === 'pt' ? 'O John está analisando seu mês…' : 'John is analyzing your month…'}</span>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-shimmer rounded-xl p-3 h-20">
              <div className="h-3 w-2/5 rounded bg-gray-200/80 dark:bg-gray-600/70" />
              <div className="mt-3 h-2.5 w-full rounded bg-gray-200/80 dark:bg-gray-600/70" />
              <div className="mt-2 h-2.5 w-3/4 rounded bg-gray-200/80 dark:bg-gray-600/70" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item, i) => (
            <article key={i} className={`rounded-xl border p-3 ${TONE[item.tone] ?? TONE.neutral}`}>
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed opacity-90">{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
