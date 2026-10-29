import { useNavigate } from 'react-router-dom';
import { MicrophoneIcon, PaperClipIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Home entry point to the assistant. The whole bar is one big tap target that opens the chat, where typing, the
 * microphone and attachments all live, instead of a second (text-only) input on the Home.
 */
export default function AskChatBar() {
  const navigate = useNavigate();
  const { language } = useSettings();
  const pt = language === 'pt';

  return (
    <button
      type="button"
      onClick={() => navigate('/chat')}
      aria-label={pt ? 'Abrir o assistente Elio' : 'Open the Elio assistant'}
      className="mb-4 md:mb-6 flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-gray-800 p-3 text-left shadow-sm transition-colors hover:bg-violet-50 dark:hover:bg-gray-700/60 active:bg-violet-100"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
        <SparklesIcon className="h-5 w-5 text-violet-600 dark:text-violet-300" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{pt ? 'Fale com o Elio' : 'Talk to Elio'}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{pt ? 'Pergunte, envie extratos ou fale' : 'Ask, send files or speak'}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-violet-600 dark:text-violet-300">
        <PaperClipIcon className="h-5 w-5" />
        <MicrophoneIcon className="h-6 w-6" />
      </span>
    </button>
  );
}
