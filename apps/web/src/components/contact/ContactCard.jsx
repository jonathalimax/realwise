import { useState } from 'react';
import { ChatBubbleLeftRightIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import ContactSheet from './ContactSheet';

/** Settings entry: opens the contact sheet (WhatsApp, email, message form). */
export default function ContactCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="mb-0.5 font-bold text-gray-900 dark:text-white">Fale com a gente</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp, e-mail ou uma mensagem direta</p>
            </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400" />
        </div>
      </button>
      {open && <ContactSheet onClose={() => setOpen(false)} />}
    </>
  );
}
