import { useState } from 'react';
import { ChatBubbleLeftRightIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import BottomSheet from '../chat/BottomSheet';
import { useAuth } from '../../contexts/AuthContext';
import { supportResource } from '../../lib/api/resources/support';
import { mailtoUrl, useSupportConfig, whatsappUrl } from './useSupportConfig';

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-violet-900/40';

/** Talk to us: WhatsApp, email, or a message that lands in the admin inbox. */
export default function ContactSheet({ onClose }) {
  const { user } = useAuth();
  const config = useSupportConfig();
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const loggedIn = Boolean(user);

  const canSend = message.trim().length >= 5 && (loggedIn || /\S+@\S+\.\S+/.test(email)) && state !== 'sending';

  const send = async () => {
    setState('sending');
    try {
      await supportResource.sendMessage({ message: message.trim(), name: name.trim() || undefined, email: email.trim() || undefined });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <BottomSheet title="Fale com a gente" subtitle="Respondemos o mais rápido que conseguimos." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <a
          href={whatsappUrl(config.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          WhatsApp
        </a>
        <a
          href={mailtoUrl(config.email)}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-violet-50 px-3 py-4 text-sm font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300"
        >
          <EnvelopeIcon className="h-6 w-6" />
          E-mail
        </a>
      </div>
      <p className="text-center text-xs text-gray-400">{config.email}</p>

      <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <p className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Ou envie uma mensagem aqui</p>
        {state === 'sent' ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
            Mensagem enviada! Vamos responder por e-mail em breve.
          </p>
        ) : (
          <div className="space-y-2.5">
            {!loggedIn && (
              <>
                <input className={inputClass} placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={inputClass} placeholder="Seu e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </>
            )}
            <textarea
              className={`${inputClass} min-h-28 resize-none`}
              placeholder="Como podemos ajudar?"
              value={message}
              maxLength={4000}
              onChange={(e) => setMessage(e.target.value)}
            />
            {state === 'error' && (
              <p className="text-sm text-gray-600 dark:text-gray-300">Não consegui enviar agora. Tente de novo ou fale pelo WhatsApp.</p>
            )}
            <button
              onClick={send}
              disabled={!canSend}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {state === 'sending' ? 'Enviando…' : 'Enviar mensagem'}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
