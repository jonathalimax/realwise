import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpIcon, PaperClipIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';

/** Home entry point to the assistant: type a question (or jump in to attach files). */
export default function AskChatBar() {
  const navigate = useNavigate();
  const { language } = useSettings();
  const pt = language === 'pt';
  const [value, setValue] = useState('');

  const go = (e) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
  };

  return (
    <form onSubmit={go} className="mb-4 md:mb-6 flex items-center gap-2 rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-2">
      <SparklesIcon className="w-6 h-6 ml-2 text-violet-500 shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={500}
        placeholder={pt ? 'Pergunte ao John qualquer coisa sobre suas finanças…' : 'Ask John anything about your finances…'}
        className="flex-1 min-w-0 bg-transparent px-1 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => navigate('/chat')}
        className="p-2 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30"
        aria-label={pt ? 'Anexar extratos no chat' : 'Attach statements in chat'}
      >
        <PaperClipIcon className="w-5 h-5" />
      </button>
      <button type="submit" className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700" aria-label={pt ? 'Perguntar' : 'Ask'}>
        <ArrowUpIcon className="w-5 h-5" />
      </button>
    </form>
  );
}
