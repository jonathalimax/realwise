import { useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import BottomSheet from '../chat/BottomSheet';
import { supportResource } from '../../lib/api/resources/support';
import { clearLoginSession } from '../../lib/auth/sessionAge';

const CONFIRM_WORD = 'EXCLUIR';

/** Danger zone: permanently deletes the account and all of its data after a typed confirmation. */
export default function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState('idle'); // idle | deleting | error
  const [message, setMessage] = useState('');

  const confirmDelete = async () => {
    setState('deleting');
    try {
      await supportResource.deleteAccount(CONFIRM_WORD);
      clearLoginSession();
      window.location.replace('/login?deleted=1');
    } catch (e) {
      setState('error');
      setMessage(
        e?.status === 403
          ? 'Esta conta não pode ser excluída por aqui. Fale com a gente.'
          : 'Não consegui excluir agora. Tente de novo em instantes ou fale com a gente.',
      );
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white dark:border-rose-900/50 dark:bg-gray-800">
        <button
          onClick={() => {
            setTyped('');
            setState('idle');
            setOpen(true);
          }}
          className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <TrashIcon className="h-5 w-5 shrink-0" />
          Excluir minha conta
        </button>
      </div>

      {open && (
        <BottomSheet title="Excluir conta" subtitle="Esta ação não pode ser desfeita." onClose={() => state !== 'deleting' && setOpen(false)}>
          <div className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-100">
            <p>Vamos apagar para sempre:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Todas as suas transações, contas, categorias e importações</li>
              <li>O histórico das conversas com o Elio</li>
              <li>Seus dados de acesso</li>
            </ul>
            <p>Se você tem uma assinatura ativa, ela será cancelada agora.</p>
          </div>
          <label className="block text-sm text-gray-700 dark:text-gray-200">
            Para confirmar, digite <strong>{CONFIRM_WORD}</strong>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase text-gray-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          {state === 'error' && <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>}
          <button
            onClick={confirmDelete}
            disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || state === 'deleting'}
            className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
          >
            {state === 'deleting' ? 'Excluindo…' : 'Excluir minha conta para sempre'}
          </button>
        </BottomSheet>
      )}
    </>
  );
}
