import { useState } from 'react';
import BottomSheet from './BottomSheet';

const TYPES = [
  { value: 'checking', pt: 'Conta corrente', en: 'Checking' },
  { value: 'credit', pt: 'Cartão de crédito', en: 'Credit card' },
  { value: 'wallet', pt: 'Carteira digital', en: 'Digital wallet' },
  { value: 'savings', pt: 'Poupança', en: 'Savings' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// 16px on mobile: below that iOS zooms the whole page when a field is focused.
const FIELD =
  'w-full rounded-xl border border-[var(--rw-border)] bg-transparent px-3 py-2.5 text-base sm:text-sm text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--rw-brand)]';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--rw-muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--rw-muted)]">{hint}</span>}
    </label>
  );
}

/** The form Elio opens to register a bank account or card: bank, type, name, holder and (for cards) closing/due day. */
export default function AccountFormSheet({ message, language, busy, error, onSubmit, onUseExisting, onClose }) {
  const pt = language === 'pt';
  const question = (message.questions ?? []).find((q) => q.kind === 'account_form' && !q.answer);
  const banks = question?.options ?? [];

  const prefill = question?.prefill;
  const existing = question?.existing;
  const [bankId, setBankId] = useState(prefill?.bankId ?? banks[0]?.value ?? 'nubank');
  const [customBankName, setCustomBankName] = useState('');
  const [type, setType] = useState(prefill?.type ?? 'checking');
  const [withCard, setWithCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [holderName, setHolderName] = useState('');
  const [closingDay, setClosingDay] = useState(10);
  const [paymentDay, setPaymentDay] = useState(15);

  const credit = type === 'credit';
  const cardAfter = type === 'checking' && withCard;
  const valid = holderName.trim().length > 1 && (bankId !== 'other' || customBankName.trim()) && (!(credit || cardAfter) || (closingDay && paymentDay));

  const submit = () => {
    onSubmit({
      bankId,
      ...(bankId === 'other' ? { customBankName: customBankName.trim() } : {}),
      type,
      ...(cardName.trim() ? { cardName: cardName.trim() } : {}),
      holderName: holderName.trim(),
      ...(credit ? { closingDay: Number(closingDay), paymentDay: Number(paymentDay) } : {}),
      ...(cardAfter ? { alsoCard: { closingDay: Number(closingDay), paymentDay: Number(paymentDay) } } : {}),
    });
  };

  return (
    <BottomSheet
      title={question?.title ?? (pt ? 'Cadastre sua conta ou cartão' : 'Add your account or card')}
      subtitle={question?.subtitle}
      onClose={onClose}
      footer={
        <div>
          {existing && onUseExisting && (
            <button
              onClick={() => onUseExisting({ questionId: question.id, value: existing.value, label: existing.label })}
              disabled={busy}
              className="mb-2 w-full rounded-xl border border-[var(--rw-border)] py-2.5 text-xs font-bold text-[var(--rw-ink)] disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {pt ? `Importar em ${existing.label}` : `Import into ${existing.label}`}
            </button>
          )}
          {error && <p className="mb-2 text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[var(--rw-muted)] hover:bg-gray-100 dark:hover:bg-gray-800">
            {pt ? 'Depois' : 'Later'}
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="flex-1 rounded-xl bg-[var(--rw-brand)] py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-violet-700"
          >
            {busy ? (pt ? 'Salvando…' : 'Saving…') : pt ? 'Salvar conta' : 'Save account'}
          </button>
          </div>
        </div>
      }
    >
      <Field label={pt ? 'Banco' : 'Bank'}>
        <select value={bankId} onChange={(e) => setBankId(e.target.value)} className={FIELD}>
          {banks.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>

      {bankId === 'other' && (
        <Field label={pt ? 'Nome do banco' : 'Bank name'}>
          <input value={customBankName} maxLength={80} onChange={(e) => setCustomBankName(e.target.value)} placeholder={pt ? 'Ex.: Banco XYZ' : 'e.g. XYZ Bank'} className={FIELD} />
        </Field>
      )}

      <div role="radiogroup" aria-label={pt ? 'Tipo' : 'Type'}>
        <span className="mb-1 block text-xs font-semibold text-[var(--rw-muted)]">{pt ? 'Tipo' : 'Type'}</span>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                type === t.value
                  ? 'border-violet-500 bg-[var(--rw-brand)] text-white'
                  : 'border-[var(--rw-border)] text-[var(--rw-ink)] hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {pt ? t.pt : t.en}
            </button>
          ))}
        </div>
      </div>

      <Field label={pt ? 'Nome da conta ou cartão (opcional)' : 'Account or card name (optional)'}>
        <input value={cardName} maxLength={80} onChange={(e) => setCardName(e.target.value)} placeholder={pt ? 'Ex.: Nubank Cartão' : 'e.g. Nubank Card'} className={FIELD} />
      </Field>

      <Field
        label={pt ? 'Titular da conta' : 'Account holder'}
        hint={pt ? 'Nome completo, como aparece no extrato. Ajuda a reconhecer transferências entre as suas contas.' : 'Full name as shown on the statement. Helps recognise transfers between your accounts.'}
      >
        <input value={holderName} maxLength={120} onChange={(e) => setHolderName(e.target.value)} placeholder={pt ? 'Ex.: Maria Souza Lima' : 'e.g. Maria Souza Lima'} className={FIELD} autoComplete="name" />
      </Field>

      {type === 'checking' && (
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--rw-ink)]">
          <input type="checkbox" checked={withCard} onChange={(e) => setWithCard(e.target.checked)} />
          {pt ? 'Também cadastrar o cartão de crédito deste banco' : 'Also add this bank’s credit card'}
        </label>
      )}
      {credit && (
        <p className="text-[11px] text-[var(--rw-muted)]">
          {pt ? 'Se você ainda não tem conta corrente nesse banco, eu crio junto.' : 'If you have no checking account at this bank yet, I create it too.'}
        </p>
      )}

      {(credit || cardAfter) && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={pt ? 'Dia de fechamento' : 'Closing day'}>
            <select value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className={FIELD}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label={pt ? 'Dia de vencimento' : 'Due day'}>
            <select value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} className={FIELD}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </BottomSheet>
  );
}
