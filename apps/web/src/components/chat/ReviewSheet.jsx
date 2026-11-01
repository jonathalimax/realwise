import { useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import BottomSheet from './BottomSheet';

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const METHOD_LABEL = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'PIX',
  transfer: 'Transferência',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  other: 'Outro',
};

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function longDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "12 de ago. de 2026 · Crédito · Nubank Cartão" — the extra detail, only shown when a row is tapped. */
function detailLine(item, account) {
  return [longDate(item.date), item.paymentMethod ? METHOD_LABEL[item.paymentMethod] : null, account].filter(Boolean).join(' · ');
}

/** One transaction in an expanded group: a compact line; tap to read the full description and details. */
function ItemRow({ item, account, type }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span className="flex items-start gap-2 text-xs">
          <span className="shrink-0 tabular-nums text-gray-400">{shortDate(item.date)}</span>
          <span className={`min-w-0 flex-1 break-words text-[var(--rw-ink)] ${open ? '' : 'line-clamp-2'}`}>{item.description}</span>
          <span className={`shrink-0 font-semibold tabular-nums ${type === 'income' ? 'text-emerald-600' : 'text-[var(--rw-ink)]'}`}>
            {brl(item.amount)}
          </span>
        </span>
        {open && <span className="mt-1 block text-[11px] text-[var(--rw-muted)]">{detailLine(item, account)}</span>}
      </button>
    </li>
  );
}

/**
 * Rows Elio already saved but is unsure how to categorize. One card per merchant; a lone transaction shows its
 * full details up front, a group expands to its list. Confirming updates the saved rows directly, and
 * "remember" teaches Elio for next time.
 */
export default function ReviewSheet({ message, language, busy, onApply, onClose }) {
  const pt = language === 'pt';
  const { groups, categories } = message.review;
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const [choice, setChoice] = useState(() =>
    Object.fromEntries(groups.map((g) => [g.key, g.currentCategoryId ?? g.suggestionIds[0] ?? ''])),
  );
  const [remember, setRemember] = useState(() => Object.fromEntries(groups.map((g) => [g.key, true])));
  // Groups Elio thinks may be transfers between the user's own accounts: true = "yes, it is a transfer".
  const [transfer, setTransfer] = useState(() => Object.fromEntries(groups.map((g) => [g.key, false])));
  // "Don't count this" (e.g. a card invoice payment): kept in the list but left out of every total, with no category.
  const [ignore, setIgnore] = useState(() => Object.fromEntries(groups.map((g) => [g.key, false])));
  const [expanded, setExpanded] = useState(() => new Set());

  const apply = () => {
    const decisions = groups
      .filter((g) => transfer[g.key] || ignore[g.key] || choice[g.key])
      .map((g) => {
        if (transfer[g.key]) return { key: g.key, transfer: true, remember: remember[g.key] };
        if (ignore[g.key]) return { key: g.key, ignore: true, remember: remember[g.key] };
        return { key: g.key, categoryId: choice[g.key], remember: remember[g.key] };
      });
    onApply(decisions);
  };

  const toggleGroup = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const count = groups.reduce((acc, g) => acc + g.count, 0);

  return (
    <BottomSheet
      title={groups.some((g) => g.transferAsk) ? (pt ? 'Confirme categorias e transferências' : 'Confirm categories and transfers') : pt ? 'Confirme as categorias' : 'Confirm categories'}
      subtitle={
        pt
          ? `${count} transações já foram salvas. Ajuste as que eu errei.`
          : `${count} transactions are already saved. Fix the ones I got wrong.`
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[var(--rw-muted)] hover:bg-gray-100 dark:hover:bg-gray-800">
            {pt ? 'Depois' : 'Later'}
          </button>
          <button
            onClick={apply}
            disabled={busy}
            className="flex-1 rounded-xl bg-[var(--rw-brand)] py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-violet-700"
          >
            {busy ? (pt ? 'Salvando…' : 'Saving…') : pt ? 'Confirmar categorias' : 'Confirm categories'}
          </button>
        </div>
      }
    >
      {groups.map((g) => {
        // Every category is selectable: the ones matching this line's type first, the rest under "other categories".
        const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
        const sameType = categories.filter((c) => !c.type || c.type === g.type).sort(byName);
        const otherType = categories.filter((c) => c.type && c.type !== g.type).sort(byName);
        const typeName = (t) => (t === 'income' ? (pt ? 'Entradas' : 'Income') : pt ? 'Saídas' : 'Expenses');
        const items = g.items ?? [];
        const single = g.count === 1 && items[0];
        const isOpen = expanded.has(g.key);
        return (
          <div key={g.key} className="rounded-2xl border border-[var(--rw-border)] p-3">
            {single ? (
              // One transaction: show everything needed to recognise it right away.
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-bold text-[var(--rw-ink)]">{items[0].description}</p>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${g.type === 'income' ? 'text-emerald-600' : 'text-[var(--rw-ink)]'}`}>
                    {brl(items[0].amount)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-[var(--rw-muted)]">{detailLine(items[0], g.account)}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 line-clamp-2 break-words text-sm font-bold text-[var(--rw-ink)]">
                    {g.merchant}
                    <span className="ml-1 font-semibold text-gray-400">×{g.count}</span>
                  </p>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${g.type === 'income' ? 'text-emerald-600' : 'text-[var(--rw-ink)]'}`}>
                    {brl(g.total)}
                  </p>
                </div>
                {g.account && <p className="mt-0.5 text-xs text-[var(--rw-muted)]">{g.account}</p>}
                {items.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={isOpen}
                      className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--rw-brand-ink)]"
                    >
                      {isOpen ? (pt ? 'Ocultar lançamentos' : 'Hide transactions') : pt ? `Ver ${g.count} lançamentos` : `View ${g.count} transactions`}
                      <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
                        {items.map((item) => (
                          <ItemRow key={item.id} item={item} account={g.account} type={g.type} />
                        ))}
                        {g.count > items.length && (
                          <li className="px-2 py-1.5 text-xs text-gray-400">
                            {pt ? `+ ${g.count - items.length} lançamentos` : `+ ${g.count - items.length} more`}
                          </li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {g.transferAsk && (
              <div className="mt-3" role="radiogroup" aria-label={pt ? 'É uma transferência entre as suas contas?' : 'Is this a transfer between your accounts?'}>
                <p className="mb-1.5 text-xs font-semibold text-[var(--rw-muted)]">
                  {pt ? 'É uma transferência entre as suas contas?' : 'Is this a transfer between your own accounts?'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: true, label: pt ? 'Sim, é minha' : 'Yes, it is mine' },
                    { value: false, label: pt ? 'Não, é normal' : 'No, regular' },
                  ].map((o) => (
                    <button
                      key={String(o.value)}
                      role="radio"
                      aria-checked={transfer[g.key] === o.value}
                      onClick={() => {
                        setTransfer((prev) => ({ ...prev, [g.key]: o.value }));
                        if (o.value) setIgnore((prev) => ({ ...prev, [g.key]: false }));
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        transfer[g.key] === o.value
                          ? 'border-violet-500 bg-[var(--rw-brand)] text-white'
                          : 'border-[var(--rw-border)] text-[var(--rw-ink)] hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {transfer[g.key] && (
                  <p className="mt-1.5 text-[11px] text-[var(--rw-muted)]">
                    {pt
                      ? 'Fica fora das suas receitas e despesas e é ligada ao outro lado, se ele já estiver importado.'
                      : 'It is left out of income and expenses and linked to its other side if that is already imported.'}
                  </p>
                )}
              </div>
            )}

            {!transfer[g.key] && (
              <label className="mt-3 flex items-start gap-2 text-xs text-[var(--rw-ink)]">
                <input
                  type="checkbox"
                  checked={ignore[g.key]}
                  onChange={(e) => setIgnore((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                  className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-[var(--rw-brand)]"
                />
                <span>
                  <span className="font-semibold">{pt ? 'Não contar nos totais' : "Don't count in totals"}</span>
                  <span className="block text-[11px] text-[var(--rw-muted)]">
                    {pt ? 'Ex.: pagamento da fatura do cartão. Fica sem categoria e fora das receitas e despesas.' : 'E.g. a card bill payment. No category, left out of income and expenses.'}
                  </span>
                </span>
              </label>
            )}

            {!transfer[g.key] && !ignore[g.key] && g.suggestionIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {g.suggestionIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setChoice((prev) => ({ ...prev, [g.key]: id }))}
                    aria-pressed={choice[g.key] === id}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      choice[g.key] === id
                        ? 'border-violet-500 bg-[var(--rw-brand)] text-white'
                        : 'border-[var(--rw-border)] text-[var(--rw-ink)] hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {nameOf.get(id)}
                  </button>
                ))}
              </div>
            )}

            {/* 16px on mobile: below that iOS zooms the whole page when a field is focused */}
            {!transfer[g.key] && !ignore[g.key] && (
            <select
              value={choice[g.key]}
              onChange={(e) => setChoice((prev) => ({ ...prev, [g.key]: e.target.value }))}
              className="mt-3 w-full rounded-xl border border-[var(--rw-border)] bg-transparent px-3 py-2 text-base sm:text-sm text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--rw-brand)]"
              aria-label={pt ? `Categoria de ${g.merchant}` : `Category for ${g.merchant}`}
            >
              <option value="">{pt ? 'Deixar sem categoria' : 'Leave uncategorized'}</option>
              <optgroup label={typeName(g.type)}>
                {sameType.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              {otherType.length > 0 && (
                <optgroup label={pt ? 'Outras categorias' : 'Other categories'}>
                  {otherType.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({typeName(c.type).toLowerCase()})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            )}

            <label className="mt-2 flex items-center gap-2 text-xs text-[var(--rw-muted)]">
              <input
                type="checkbox"
                checked={remember[g.key]}
                onChange={(e) => setRemember((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                className="rounded border-gray-300 text-violet-600 focus:ring-[var(--rw-brand)]"
              />
              {transfer[g.key]
                ? pt ? 'Lembrar: sempre tratar como transferência' : 'Remember: always treat as a transfer'
                : ignore[g.key]
                ? pt ? 'Lembrar: nunca contar isso' : "Remember: never count this"
                : pt ? 'Lembrar disso nas próximas importações' : 'Remember this for future imports'}
            </label>
          </div>
        );
      })}
    </BottomSheet>
  );
}
