import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings, UNCATEGORIZED_CATEGORY } from '../contexts/SettingsContext';
import { useCards } from '../contexts/CardsContext';
import { transactionsResource } from '../lib/api/resources/transactions';

const PAYMENT_METHODS = [
  { id: 'credit', pt: 'Crédito', en: 'Credit' },
  { id: 'debit', pt: 'Débito', en: 'Debit' },
  { id: 'pix', pt: 'Pix', en: 'Pix' },
  { id: 'cash', pt: 'Dinheiro', en: 'Cash' },
];

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Chip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${on ? 'border-[var(--rw-brand)] bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'border-transparent bg-[var(--rw-raised)] text-[var(--rw-muted)]'}`}
    >
      {children}
    </button>
  );
}

/**
 * Manual entry as a bottom sheet: type, amount, what it was, a category, a day. Bank, payment method and "não contar nos
 * totais" sit under "Mais detalhes". Elio stays one tap away for anyone who would rather just say it.
 */
export default function AddTransactionSheet({ onClose }) {
  const { language, categories } = useSettings();
  const { userBanks, getBankDisplayName } = useCards();
  const pt = language === 'pt';
  const today = useMemo(() => new Date(), []);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dayChoice, setDayChoice] = useState('today');
  const [customDay, setCustomDay] = useState(isoDay(today));
  const [more, setMore] = useState(false);
  const [bankId, setBankId] = useState('');
  const [method, setMethod] = useState('debit');
  const [ignored, setIgnored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const uncategorized = UNCATEGORIZED_CATEGORY[language] ?? UNCATEGORIZED_CATEGORY.pt;
  const options = (categories?.[type] ?? []).filter((c) => c !== uncategorized);
  const shown = options.slice(0, 6);
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? options : shown;

  const value = Number(String(amount).replace(/\./g, '').replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0 && description.trim().length > 0;
  const day = dayChoice === 'today' ? isoDay(today) : dayChoice === 'yesterday' ? isoDay(new Date(today.getTime() - 86400000)) : customDay;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await transactionsResource.create({
        type,
        amount: value.toFixed(2),
        description: description.trim(),
        date: day,
        category: category || uncategorized,
        ...(bankId ? { bankId } : {}),
        ...(type === 'expense' && bankId ? { paymentMethod: method } : {}),
        ...(ignored ? { ignored: true } : {}),
      });
      onClose();
    } catch {
      setError(pt ? 'Não consegui salvar. Tente de novo.' : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={pt ? 'Novo movimento' : 'New entry'}>
      <button type="button" aria-label={pt ? 'Fechar' : 'Close'} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-[28px] border border-b-0 border-[var(--rw-border)] bg-[var(--rw-surface)] px-4 pb-6 pt-3 text-[var(--rw-ink)]">
        <span className="mx-auto h-1 w-10 rounded-full bg-[var(--rw-border)]" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{pt ? 'Novo movimento' : 'New entry'}</h2>
          <button type="button" onClick={onClose} className="min-h-[44px] px-1 text-sm font-semibold text-[var(--rw-muted)]">{pt ? 'Fechar' : 'Close'}</button>
        </div>

        <div className="flex gap-0.5 rounded-[14px] bg-[var(--rw-raised)] p-[3px]" role="tablist">
          {[['expense', pt ? 'Saída' : 'Out'], ['income', pt ? 'Entrada' : 'In']].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={type === k} onClick={() => { setType(k); setCategory(''); }}
              className={`h-[38px] flex-1 rounded-[11px] text-sm font-semibold ${type === k ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>
              {label}
            </button>
          ))}
        </div>

        <label className="flex flex-col items-center gap-1 py-2">
          <span className="text-[13px] font-medium text-[var(--rw-subtle)]">{pt ? 'Quanto foi?' : 'How much?'}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0,00"
            aria-label={pt ? 'Valor' : 'Amount'}
            className={`w-full bg-transparent text-center text-5xl font-extrabold tabular-nums tracking-tight outline-none placeholder:text-[var(--rw-subtle)] ${type === 'income' ? 'text-[var(--rw-pos)]' : ''}`}
          />
        </label>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={pt ? 'O que foi?' : 'What was it?'}
          aria-label={pt ? 'Descrição' : 'Description'}
          className="h-[52px] rounded-[14px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3.5 text-[15px] outline-none"
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rw-muted)]">{pt ? 'Categoria' : 'Category'}</span>
          <div className="flex flex-wrap gap-2">
            {list.map((c) => <Chip key={c} on={category === c} onClick={() => setCategory(category === c ? '' : c)}>{c}</Chip>)}
            {options.length > shown.length && !showAll && <Chip onClick={() => setShowAll(true)}>{pt ? 'Mais' : 'More'}</Chip>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rw-muted)]">{pt ? 'Quando' : 'When'}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={dayChoice === 'today'} onClick={() => setDayChoice('today')}>{pt ? 'Hoje' : 'Today'}</Chip>
            <Chip on={dayChoice === 'yesterday'} onClick={() => setDayChoice('yesterday')}>{pt ? 'Ontem' : 'Yesterday'}</Chip>
            <Chip on={dayChoice === 'other'} onClick={() => setDayChoice('other')}>{pt ? 'Outra data' : 'Other date'}</Chip>
            {dayChoice === 'other' && (
              <input type="date" value={customDay} max={isoDay(today)} onChange={(e) => setCustomDay(e.target.value)} aria-label={pt ? 'Data' : 'Date'}
                className="h-10 rounded-[12px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3 text-sm outline-none" />
            )}
          </div>
        </div>

        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex items-center justify-between text-left">
          <span>
            <span className="block text-[15px] font-semibold">{pt ? 'Mais detalhes' : 'More details'}</span>
            <span className="block text-[13px] text-[var(--rw-subtle)]">{pt ? 'Banco, forma de pagamento, não contar nos totais' : 'Bank, payment method, leave out of totals'}</span>
          </span>
          <span className={`text-[var(--rw-muted)] transition-transform ${more ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {more && (
          <div className="flex flex-col gap-3">
            <select value={bankId} onChange={(e) => setBankId(e.target.value)} aria-label={pt ? 'Banco' : 'Bank'}
              className="h-[52px] rounded-[14px] border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3 text-[15px]">
              <option value="">{pt ? 'Sem banco (dinheiro)' : 'No bank (cash)'}</option>
              {userBanks.map((b) => <option key={b.id} value={b.id}>{getBankDisplayName(b)}</option>)}
            </select>
            {type === 'expense' && bankId && (
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.filter((m) => m.id !== 'cash').map((m) => <Chip key={m.id} on={method === m.id} onClick={() => setMethod(m.id)}>{pt ? m.pt : m.en}</Chip>)}
              </div>
            )}
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" checked={ignored} onChange={(e) => setIgnored(e.target.checked)} className="h-5 w-5 accent-[var(--rw-brand)]" />
              {pt ? 'Não contar nos totais' : 'Leave out of totals'}
            </label>
          </div>
        )}

        {error && <p className="text-sm text-[var(--rw-neg)]" role="alert">{error}</p>}
        <button type="button" onClick={save} disabled={!valid || saving} className="h-[52px] rounded-[14px] bg-[var(--rw-brand)] text-[15px] font-bold text-white disabled:opacity-50">
          {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
        </button>
        <Link to="/chat" onClick={onClose} className="self-center text-sm font-semibold text-[var(--rw-brand-ink)]">
          {pt ? 'Prefere conversar? Fale com o Elio' : 'Rather chat? Talk to Elio'}
        </Link>
      </div>
    </div>
  );
}
