import { useState } from 'react';
import { CheckCircleIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/solid';
import BottomSheet from './BottomSheet';

const NEW = '__new__';

/** Multiple-choice questions from Elio (which account / how it was paid). Answers are sent back as the next message. */
export default function QuestionSheet({ message, language, busy, onSubmit, onClose }) {
  const pt = language === 'pt';
  const pending = (message.questions ?? []).filter((q) => !q.answer);
  const onlyConfirm = pending.length > 0 && pending.every((q) => q.kind === 'confirm');
  const destructive = pending.some((q) => q.danger);
  // picks[questionId] = { value, label } | { value: NEW, text }
  const [picks, setPicks] = useState({});

  const complete = pending.every((q) => {
    const p = picks[q.id];
    return p && (p.value !== NEW || p.text?.trim());
  });

  const submit = () => {
    const answers = pending.map((q) => {
      const p = picks[q.id];
      return p.value === NEW
        ? { questionId: q.id, value: `new:${p.text.trim()}`, label: p.text.trim() }
        : { questionId: q.id, value: p.value, label: p.label };
    });
    onSubmit(answers);
  };

  return (
    <BottomSheet
      title={onlyConfirm ? (pt ? 'Confirme antes de eu mexer' : 'Confirm before I change anything') : pt ? 'Preciso de uma ajudinha 🙋' : 'Quick question 🙋'}
      subtitle={
        onlyConfirm
          ? pt ? 'Nada muda até você confirmar. Exclusões ficam ocultas e podem ser restauradas.' : 'Nothing changes until you confirm. Deletions are hidden and can be restored.'
          : pt ? 'Escolha uma opção em cada item para eu continuar.' : 'Pick one option in each item so I can continue.'
      }
      onClose={onClose}
      footer={
        <button
          onClick={submit}
          disabled={!complete || busy}
          className={`w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 ${destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[var(--rw-brand)] hover:opacity-90'}`}
        >
          {busy ? (pt ? 'Enviando…' : 'Sending…') : onlyConfirm ? (pt ? 'Enviar resposta' : 'Send answer') : pt ? 'Confirmar' : 'Confirm'}
        </button>
      }
    >
      {pending.map((q) => (
        <fieldset key={q.id} className="min-w-0 rounded-2xl border border-[var(--rw-border)] p-3">
          <legend className="sr-only">{q.title}</legend>
          <p className="break-words text-sm font-bold text-[var(--rw-ink)]">{q.title}</p>
          {q.fileName && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[var(--rw-raised)] px-2 py-0.5 text-xs text-[var(--rw-muted)]">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              <span className="max-w-[14rem] truncate">{q.fileName}</span>
            </span>
          )}
          {q.subtitle && <p className="mt-1 break-words text-xs text-[var(--rw-muted)]">{q.subtitle}</p>}
          {Array.isArray(q.preview) && q.preview.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl bg-gray-50 dark:bg-gray-800 p-2 text-xs text-[var(--rw-ink)]">
              {q.preview.map((line, i) => (
                <li key={i} className="flex gap-1.5 break-words leading-snug"><span aria-hidden>•</span><span className="min-w-0">{line}</span></li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-2" role="radiogroup">
            {q.options.map((o) => {
              const selected = picks[q.id]?.value === o.value;
              return (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPicks((prev) => ({ ...prev, [q.id]: { value: o.value, label: o.label } }))}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? q.danger && o.value === 'yes'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-100'
                        : 'border-violet-500 bg-[var(--rw-brand-soft)] text-violet-900 dark:text-violet-100'
                      : 'border-[var(--rw-border)] text-[var(--rw-ink)] hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{o.label}</span>
                    {o.hint && <span className="ml-2 text-xs text-gray-400">{o.hint}</span>}
                  </span>
                  {selected && <CheckCircleIcon className="w-5 h-5 shrink-0 text-violet-600" />}
                </button>
              );
            })}

            {q.allowNew && (
              <>
                <button
                  role="radio"
                  aria-checked={picks[q.id]?.value === NEW}
                  onClick={() => setPicks((prev) => ({ ...prev, [q.id]: { value: NEW, text: prev[q.id]?.text ?? '' } }))}
                  className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    picks[q.id]?.value === NEW
                      ? 'border-violet-500 bg-[var(--rw-brand-soft)] text-violet-900 dark:text-violet-100'
                      : 'border-[var(--rw-border)] text-[var(--rw-muted)] hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <PlusIcon className="w-4 h-4" />
                  {pt ? 'Outra conta ou cartão' : 'Another account or card'}
                </button>
                {picks[q.id]?.value === NEW && (
                  <input
                    autoFocus
                    value={picks[q.id].text}
                    maxLength={80}
                    onChange={(e) => setPicks((prev) => ({ ...prev, [q.id]: { value: NEW, text: e.target.value } }))}
                    placeholder={pt ? 'Ex.: Itaú Conta, Nubank Cartão' : 'e.g. Itaú Checking, Nubank Card'}
                    className="rounded-xl border border-[var(--rw-border)] bg-transparent px-3 py-2 text-base sm:text-sm text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--rw-brand)]"
                  />
                )}
              </>
            )}
          </div>
        </fieldset>
      ))}
    </BottomSheet>
  );
}
