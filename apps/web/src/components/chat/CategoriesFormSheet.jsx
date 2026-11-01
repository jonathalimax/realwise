import { useMemo, useState } from 'react';
import BottomSheet from './BottomSheet';

const GROUPS = [
  { key: 'needs', pt: 'Necessidades', en: 'Needs', color: 'var(--rw-needs)' },
  { key: 'wants', pt: 'Desejos', en: 'Wants', color: 'var(--rw-wants)' },
  { key: 'savings', pt: 'Poupança', en: 'Savings', color: 'var(--rw-save)' },
  { key: 'income', pt: 'Entradas', en: 'Income', color: 'var(--rw-pos)' },
];

/**
 * Interview step: the person turns on the ready-made categories that fit their life. The basics start on; everything
 * else is opt-in. Options come from the question (`hint` = "<group>" or "<group>:basic"), so the app and the API
 * share one catalog.
 */
export default function CategoriesFormSheet({ message, language, busy, error, onSubmit, onClose }) {
  const pt = language === 'pt';
  const question = (message.questions ?? []).find((q) => q.kind === 'categories_form' && !q.answer);
  const items = useMemo(
    () => (question?.options ?? []).map((o) => {
      const [group, basic] = String(o.hint ?? '').split(':');
      return { name: o.value, group, basic: basic === 'basic' };
    }),
    [question],
  );
  // Income and expense can share a name ("Investimentos"), so selection is keyed by type + name.
  const keyOf = (i) => `${i.group === 'income' ? 'in' : 'out'}:${i.name}`;
  const [pickedKeys, setPickedKeys] = useState(() => new Set(items.filter((i) => i.basic).map(keyOf)));
  const toggleKey = (i) => setPickedKeys((prev) => { const next = new Set(prev); const k = keyOf(i); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  const names = [...new Set(items.filter((i) => pickedKeys.has(keyOf(i))).map((i) => i.name))];

  return (
    <BottomSheet
      title={question?.title ?? (pt ? 'Escolha suas categorias' : 'Choose your categories')}
      subtitle={question?.subtitle ?? (pt ? 'Já deixei as principais ligadas. Ligue as que fazem sentido para você. Dá para mudar depois.' : 'The main ones are already on. Turn on the ones that fit you. You can change this later.')}
      onClose={onClose}
      footer={
        <div>
          {error && <p className="mb-2 text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">{pt ? 'Depois' : 'Later'}</button>
            <button
              onClick={() => onSubmit({ names })}
              disabled={busy}
              className="flex-1 rounded-xl bg-[var(--rw-brand)] py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy ? (pt ? 'Salvando…' : 'Saving…') : pt ? `Confirmar (${pickedKeys.size})` : `Confirm (${pickedKeys.size})`}
            </button>
          </div>
        </div>
      }
    >
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key} className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
              <span className="text-sm font-bold text-gray-900 dark:text-white">{pt ? g.pt : g.en}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {list.map((i) => {
                const on = pickedKeys.has(keyOf(i));
                return (
                  <button
                    key={keyOf(i)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleKey(i)}
                    className={`h-10 rounded-full border px-4 text-sm font-semibold ${on ? 'border-[var(--rw-brand)] bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {i.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </BottomSheet>
  );
}
