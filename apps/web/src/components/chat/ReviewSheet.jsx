import { useMemo, useState } from 'react';
import BottomSheet from './BottomSheet';

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Rows John already saved but is unsure how to categorize, one card per merchant ("UBER ×7").
 * Confirming updates the saved rows directly; "remember" teaches John for next time.
 */
export default function ReviewSheet({ message, language, busy, onApply, onClose }) {
  const pt = language === 'pt';
  const { groups, categories } = message.review;
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const [choice, setChoice] = useState(() =>
    Object.fromEntries(groups.map((g) => [g.key, g.currentCategoryId ?? g.suggestionIds[0] ?? ''])),
  );
  const [remember, setRemember] = useState(() => Object.fromEntries(groups.map((g) => [g.key, true])));

  const apply = () => {
    const decisions = groups
      .filter((g) => choice[g.key])
      .map((g) => ({ key: g.key, categoryId: choice[g.key], remember: remember[g.key] }));
    onApply(decisions);
  };

  const count = groups.reduce((acc, g) => acc + g.count, 0);

  return (
    <BottomSheet
      title={pt ? 'Confirme as categorias' : 'Confirm categories'}
      subtitle={
        pt
          ? `${count} transações já foram salvas. Ajuste as que eu errei — ${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}.`
          : `${count} transactions are already saved. Fix the ones I got wrong — ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}.`
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            {pt ? 'Depois' : 'Later'}
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-violet-700"
          >
            {busy ? (pt ? 'Salvando…' : 'Saving…') : pt ? 'Confirmar categorias' : 'Confirm categories'}
          </button>
        </div>
      }
    >
      {groups.map((g) => {
        const sameType = categories.filter((c) => !c.type || c.type === g.type);
        return (
          <div key={g.key} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-white">
                {g.merchant}
                {g.count > 1 && <span className="ml-1 text-gray-400">×{g.count}</span>}
              </p>
              <p className={`shrink-0 text-sm font-semibold ${g.type === 'income' ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200'}`}>
                {brl(g.total)}
              </p>
            </div>

            {g.suggestionIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {g.suggestionIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setChoice((prev) => ({ ...prev, [g.key]: id }))}
                    aria-pressed={choice[g.key] === id}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      choice[g.key] === id
                        ? 'border-violet-500 bg-violet-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {nameOf.get(id)}
                  </button>
                ))}
              </div>
            )}

            <select
              value={choice[g.key]}
              onChange={(e) => setChoice((prev) => ({ ...prev, [g.key]: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label={pt ? `Categoria de ${g.merchant}` : `Category for ${g.merchant}`}
            >
              <option value="">{pt ? 'Deixar sem categoria' : 'Leave uncategorized'}</option>
              {sameType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={remember[g.key]}
                onChange={(e) => setRemember((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              {pt ? 'Lembrar disso nas próximas importações' : 'Remember this for future imports'}
            </label>
          </div>
        );
      })}
    </BottomSheet>
  );
}
