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
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2.5 text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>}
    </label>
  );
}

/** The form Elio opens to register a bank account or card: bank, type, name, holder and (for cards) closing/due day. */
export default function AccountFormSheet({ message, language, busy, error, onSubmit, onClose }) {
  const pt = language === 'pt';
  const question = (message.questions ?? []).find((q) => q.kind === 'account_form' && !q.answer);
  const banks = question?.options ?? [];

  const [bankId, setBankId] = useState(banks[0]?.value ?? 'nubank');
  const [customBankName, setCustomBankName] = useState('');
  const [type, setType] = useState('checking');
  const [cardName, setCardName] = useState('');
  const [holderName, setHolderName] = useState('');
  const [closingDay, setClosingDay] = useState(10);
  const [paymentDay, setPaymentDay] = useState(15);

  const credit = type === 'credit';
  const valid = holderName.trim().length > 1 && (bankId !== 'other' || customBankName.trim()) && (!credit || (closingDay && paymentDay));

  const submit = () => {
    onSubmit({
      bankId,
      ...(bankId === 'other' ? { customBankName: customBankName.trim() } : {}),
      type,
      ...(cardName.trim() ? { cardName: cardName.trim() } : {}),
      holderName: holderName.trim(),
      ...(credit ? { closingDay: Number(closingDay), paymentDay: Number(paymentDay) } : {}),
    });
  };

  return (
    <BottomSheet
      title={question?.title ?? (pt ? 'Cadastre sua conta ou cartão' : 'Add your account or card')}
      subtitle={question?.subtitle}
      onClose={onClose}
      footer={
        <div>
          {error && <p className="mb-2 text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            {pt ? 'Depois' : 'Later'}
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-violet-700"
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
        <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">{pt ? 'Tipo' : 'Type'}</span>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                type === t.value
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
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

      {credit && (
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
