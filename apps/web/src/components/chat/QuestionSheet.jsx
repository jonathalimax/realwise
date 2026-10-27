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
          className={`w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40 ${destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}
        >
          {busy ? (pt ? 'Enviando…' : 'Sending…') : onlyConfirm ? (pt ? 'Enviar resposta' : 'Send answer') : pt ? 'Confirmar' : 'Confirm'}
        </button>
      }
    >
      {pending.map((q) => (
        <fieldset key={q.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
          <legend className="sr-only">{q.title}</legend>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{q.title}</p>
          {q.fileName && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              <span className="max-w-[14rem] truncate">{q.fileName}</span>
            </span>
          )}
          {q.subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{q.subtitle}</p>}
          {Array.isArray(q.preview) && q.preview.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl bg-gray-50 dark:bg-gray-800 p-2 text-xs text-gray-700 dark:text-gray-200">
              {q.preview.map((line, i) => (
                <li key={i} className="truncate">• {line}</li>
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
                        : 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100'
                      : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
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
