import { useEffect, useState } from 'react';
import { PencilSquareIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../contexts/SettingsContext';
import { chatResource } from '../lib/api/resources/chat';

const KINDS = {
  goal: { pt: 'Objetivo', en: 'Goal', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  preference: { pt: 'Preferência', en: 'Preference', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  context: { pt: 'Contexto', en: 'Context', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
};
const MAX = 240;

/** Everything Elio remembers about the user, with edit / delete / add. Only facts the user stated live here. */
export default function MemorySettingsPage() {
  const { language } = useSettings();
  const pt = language === 'pt';
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // { id | 'new', content, kind }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    chatResource
      .memoryList()
      .then((rows) => alive && setItems(rows))
      .catch(() => {
        if (!alive) return;
        setError(pt ? 'Não consegui carregar agora.' : 'Could not load right now.');
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [pt]);

  const save = async () => {
    const content = editing.content.trim();
    if (content.length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      if (editing.id === 'new') {
        const row = await chatResource.memoryAdd({ content, kind: editing.kind });
        setItems((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      } else {
        const row = await chatResource.memoryUpdate(editing.id, { content, kind: editing.kind });
        setItems((prev) => prev.map((m) => (m.id === row.id ? row : m)));
      }
      setEditing(null);
    } catch (e) {
      setError(e?.message || (pt ? 'Não consegui salvar.' : 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    const ok = window.confirm(pt ? 'Apagar esta informação? O Elio vai esquecer.' : 'Delete this? Elio will forget it.');
    if (!ok) return;
    try {
      await chatResource.memoryRemove(item.id);
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch {
      setError(pt ? 'Não consegui apagar.' : 'Could not delete.');
    }
  };

  const editor = editing && (
    <div className="rounded-2xl border border-violet-300 dark:border-violet-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <textarea
        autoFocus
        value={editing.content}
        maxLength={MAX}
        rows={3}
        onChange={(e) => setEditing({ ...editing, content: e.target.value })}
        placeholder={pt ? 'Ex.: Quero juntar R$ 20 mil para uma viagem até dezembro' : 'e.g. I want to save R$ 20k for a trip by December'}
        className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(KINDS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => setEditing({ ...editing, kind: k })}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${editing.kind === k ? `${v.tone} border-transparent` : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
          >
            {pt ? v.pt : v.en}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{editing.content.length}/{MAX}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <XMarkIcon className="w-4 h-4" />
          {pt ? 'Cancelar' : 'Cancel'}
        </button>
        <button
          onClick={save}
          disabled={busy || editing.content.trim().length < 3}
          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
        >
          <CheckIcon className="w-4 h-4" />
          {pt ? 'Salvar' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={pt ? 'O que o Elio sabe sobre você' : 'What Elio knows about you'} showMonth={false} backTo="/settings" />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {pt
            ? 'Aqui ficam só as coisas que você contou ao Elio (objetivos, preferências e contexto) para ele te ajudar melhor. Nada é deduzido por conta própria. Você pode editar ou apagar quando quiser.'
            : 'Only things you told Elio (goals, preferences, context) are kept here so he can help you better. Nothing is guessed. Edit or delete anytime.'}
        </p>

        {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

        {items === null ? (
          <p className="text-sm text-gray-400">{pt ? 'Carregando…' : 'Loading…'}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((m) =>
              editing?.id === m.id ? (
                <li key={m.id}>{editor}</li>
              ) : (
                <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${(KINDS[m.kind] ?? KINDS.context).tone}`}>
                      {pt ? (KINDS[m.kind] ?? KINDS.context).pt : (KINDS[m.kind] ?? KINDS.context).en}
                    </span>
                    <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">{m.content}</p>
                  </div>
                  <button aria-label={pt ? 'Editar' : 'Edit'} onClick={() => setEditing({ id: m.id, content: m.content, kind: m.kind })} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <PencilSquareIcon className="w-5 h-5" />
                  </button>
                  <button aria-label={pt ? 'Apagar' : 'Delete'} onClick={() => remove(m)} className="p-1.5 text-gray-400 hover:text-rose-600">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </li>
              ),
            )}
            {items.length === 0 && !editing && (
              <li className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {pt ? 'O Elio ainda não guardou nada. Conte a ele seus objetivos no chat, ou adicione aqui.' : 'Elio has not saved anything yet. Tell him your goals in the chat, or add one here.'}
              </li>
            )}
          </ul>
        )}

        {editing?.id === 'new' ? (
          editor
        ) : (
          <button
            onClick={() => setEditing({ id: 'new', content: '', kind: 'context' })}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <PlusIcon className="w-4 h-4" />
            {pt ? 'Adicionar' : 'Add'}
          </button>
        )}
      </main>
    </div>
  );
}
