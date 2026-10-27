import { useMemo, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import BottomSheet from './BottomSheet';

const GROUPS = [
  { key: 'overdue', title: 'Atrasadas', tone: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200 dark:ring-rose-900/50' },
  { key: 'today', title: 'Vencem hoje', tone: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-900/50' },
  { key: 'soon', title: 'Próximos dias', tone: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-200 dark:ring-sky-900/50' },
];

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseAmount = (text, fallback) => {
  const n = Number(String(text).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const formatDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const daysLate = (iso) => Math.max(0, Math.floor((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000));

/**
 * Elio's checklist of pending bills: tick the ones already paid, adjust the value when it differs, submit once.
 * Works for a handful of bills without typing, and the user can still tell Elio in the chat instead.
 */
export default function BillsSheet({ message, busy, onSubmit, onClose }) {
  const items = useMemo(() => message.billsPanel?.items ?? [], [message]);
  const [checked, setChecked] = useState(() => new Set());
  const [amounts, setAmounts] = useState(() => Object.fromEntries(items.map((i) => [i.billId, String(i.amount).replace('.', ',')])));

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = items.length > 0 && checked.size === items.length;
  const valueOf = (item) => parseAmount(amounts[item.billId], item.amount);
  const total = items.filter((i) => checked.has(i.billId)).reduce((sum, i) => sum + valueOf(i), 0);

  const submit = () =>
    onSubmit(
      items.map((i) => ({
        billId: i.billId,
        paid: checked.has(i.billId),
        ...(checked.has(i.billId) && valueOf(i) !== i.amount ? { amount: valueOf(i) } : {}),
      })),
    );

  return (
    <BottomSheet
      title="Quais contas você pagou?"
      subtitle="Marque as pagas. Se o valor foi diferente, é só ajustar."
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <button
            onClick={submit}
            disabled={busy || checked.size === 0}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {busy
              ? 'Marcando…'
              : checked.size === 0
                ? 'Selecione as contas pagas'
                : `Marcar ${checked.size} como ${checked.size === 1 ? 'paga' : 'pagas'} · ${brl(total)}`}
          </button>
          <button onClick={onClose} disabled={busy} className="w-full rounded-xl py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800">
            Prefiro contar por aqui no chat
          </button>
        </div>
      }
    >
      <button
        onClick={() => setChecked(allChecked ? new Set() : new Set(items.map((i) => i.billId)))}
        className="text-xs font-bold text-violet-600 hover:underline dark:text-violet-300"
      >
        {allChecked ? 'Desmarcar todas' : 'Marcar todas como pagas'}
      </button>

      {GROUPS.map((group) => {
        const list = items.filter((i) => i.group === group.key);
        if (list.length === 0) return null;
        return (
          <section key={group.key}>
            <h3 className={`mb-1.5 text-[11px] font-black uppercase tracking-widest ${group.tone}`}>{group.title}</h3>
            <ul className="space-y-2">
              {list.map((item) => {
                const on = checked.has(item.billId);
                return (
                  <li
                    key={item.billId}
                    className={`flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 transition dark:bg-gray-800/60 ${on ? 'ring-violet-400 dark:ring-violet-500' : group.ring}`}
                  >
                    <button
                      onClick={() => toggle(item.billId)}
                      aria-pressed={on}
                      aria-label={`${on ? 'Desmarcar' : 'Marcar'} ${item.name}`}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? 'border-violet-600 bg-violet-600' : 'border-gray-300 dark:border-gray-600'}`}
                    >
                      {on && <CheckIcon className="h-4 w-4 text-white" />}
                    </button>
                    <button onClick={() => toggle(item.billId)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.group === 'overdue' ? `venceu ${formatDay(item.dueDate)} · ${daysLate(item.dueDate)}d de atraso` : item.group === 'today' ? 'vence hoje' : `vence ${formatDay(item.dueDate)}`}
                      </p>
                    </button>
                    {on ? (
                      <label className="flex shrink-0 items-center gap-1 rounded-xl bg-white px-2 py-1.5 ring-1 ring-violet-300 dark:bg-gray-900 dark:ring-violet-700">
                        <span className="text-xs text-gray-400">R$</span>
                        <input
                          value={amounts[item.billId]}
                          onChange={(e) => setAmounts((prev) => ({ ...prev, [item.billId]: e.target.value }))}
                          inputMode="decimal"
                          aria-label={`Valor pago de ${item.name}`}
                          className="w-20 bg-transparent text-right text-sm font-bold tabular-nums text-gray-900 outline-none dark:text-white"
                        />
                      </label>
                    ) : (
                      <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{brl(item.amount)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </BottomSheet>
  );
}
