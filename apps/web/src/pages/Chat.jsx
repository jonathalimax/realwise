import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpIcon, PaperClipIcon, XMarkIcon, DocumentTextIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../contexts/SettingsContext';
import { chatResource } from '../lib/api/resources/chat';

const ACCEPT = '.pdf,.csv,.xlsx,.xls,.ofx,.txt,.png,.jpg,.jpeg,.webp';
const MAX_FILES = 6;

const brl = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function SavedCard({ saved, onUndo, language }) {
  const [state, setState] = useState('idle'); // idle | undoing | undone | error
  const pt = language === 'pt';

  const undo = async () => {
    setState('undoing');
    try {
      await onUndo(saved.importId);
      setState('undone');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs">
      <div className="min-w-0">
        <p className="font-bold text-emerald-800 dark:text-emerald-300 truncate">
          {saved.saved} {pt ? 'transações em' : 'transactions in'} {saved.accountName}
        </p>
        <p className="text-emerald-700/80 dark:text-emerald-400/80">
          {saved.expense > 0 && `${pt ? 'Despesas' : 'Expenses'} ${brl(saved.expense)}`}
          {saved.expense > 0 && saved.income > 0 && ' · '}
          {saved.income > 0 && `${pt ? 'Entradas' : 'Income'} ${brl(saved.income)}`}
          {saved.duplicatesSkipped > 0 && ` · ${saved.duplicatesSkipped} ${pt ? 'duplicadas ignoradas' : 'duplicates skipped'}`}
        </p>
      </div>
      {state === 'undone' ? (
        <span className="shrink-0 font-bold text-gray-500">{pt ? 'Desfeito' : 'Undone'}</span>
      ) : (
        <button
          onClick={undo}
          disabled={state === 'undoing'}
          className="shrink-0 inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 hover:underline disabled:opacity-50"
        >
          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
          {state === 'error' ? (pt ? 'Tentar de novo' : 'Retry') : pt ? 'Desfazer' : 'Undo'}
        </button>
      )}
    </div>
  );
}

function Bubble({ message, onUndo, language }) {
  const mine = message.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine
            ? 'bg-violet-600 text-white rounded-br-md'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm'
        }`}
      >
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((file, i) => (
              <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs">
                <DocumentTextIcon className="w-3.5 h-3.5" />
                <span className="max-w-[10rem] truncate">{file.name}</span>
              </span>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {Array.isArray(message.saved) &&
          message.saved.map((saved) => (
            <SavedCard key={saved.importId} saved={saved} onUndo={onUndo} language={language} />
          ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { language } = useSettings();
  const pt = language === 'pt';
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const bottom = useRef(null);
  const autoSent = useRef(false);

  useEffect(() => {
    let active = true;
    chatResource
      .messages()
      .then((rows) => active && setMessages(Array.isArray(rows) ? rows : []))
      .catch(() => active && setError(pt ? 'Não consegui carregar a conversa.' : 'Could not load the conversation.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pt]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const addFiles = useCallback((list) => {
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, MAX_FILES));
  }, []);

  const submit = useCallback(
    async (overrideText) => {
      const message = (overrideText ?? text).trim();
      if ((!message && files.length === 0) || sending) return;
      const attached = files;
      setError('');
      setSending(true);
      setText('');
      setFiles([]);
      // Optimistic user bubble, replaced by the persisted one once the server answers.
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: message || (pt ? '(arquivos anexados)' : '(attached files)'),
        attachments: attached.map((f) => ({ name: f.name })),
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const { userMessage, assistantMessage } = await chatResource.send({ message, files: attached });
        setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), userMessage, assistantMessage]);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setText(message);
        setFiles(attached);
        setError(e?.message || (pt ? 'Algo deu errado. Tente novamente.' : 'Something went wrong. Please try again.'));
      } finally {
        setSending(false);
      }
    },
    [text, files, sending, pt],
  );

  // Question typed in the home "ask" bar arrives as ?q=...
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q || loading || autoSent.current) return;
    autoSent.current = true;
    setSearchParams({}, { replace: true });
    submit(q);
  }, [searchParams, loading, setSearchParams, submit]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const suggestions = pt
    ? ['Quanto gastei no mês passado?', 'Onde posso economizar?', 'Qual minha maior despesa este mês?']
    : ['How much did I spend last month?', 'Where can I save?', 'What is my biggest expense this month?'];

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader title="John" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 pb-44 space-y-3">
        {!loading && messages.length === 0 && (
          <div className="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm text-sm text-gray-700 dark:text-gray-300 space-y-3">
            <p className="font-bold text-gray-900 dark:text-white">
              {pt ? 'Oi, eu sou o John! Vamos cuidar bem do seu dinheiro? 💜' : "Hi, I'm John! Let's take good care of your money 💜"}
            </p>
            <p>
              {pt
                ? 'Envie seus extratos, faturas e comprovantes (PDFs, planilhas ou fotos, vários de uma vez) que eu organizo tudo e descubro a conta de cada um. Você também pode escrever "gastei 45 no mercado", cadastrar uma conta a pagar ou me perguntar qualquer coisa sobre suas finanças.'
                : 'Send your statements, invoices and receipts (PDFs, spreadsheets or photos, several at once) and I will organise everything and work out which account each belongs to. You can also type "spent 45 at the market", add a bill, or ask me anything about your finances.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-violet-200 dark:border-violet-800 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            language={language}
            onUndo={async (importId) => {
              await chatResource.undoImport(importId);
            }}
          />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 px-4 py-3 shadow-sm flex gap-1" aria-label={pt ? 'John está pensando' : 'John is thinking'}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-gradient-to-t from-gray-50 via-gray-50 dark:from-gray-900 dark:via-gray-900 to-transparent pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          {error && <p className="mb-2 text-xs font-semibold text-rose-600">{error}</p>}
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((file, i) => (
                <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                  <DocumentTextIcon className="w-4 h-4 text-violet-500" />
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label={pt ? 'Remover' : 'Remove'}>
                    <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="p-2 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30"
              aria-label={pt ? 'Anexar arquivos' : 'Attach files'}
            >
              <PaperClipIcon className="w-6 h-6" />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={pt ? 'Fale com o John ou anexe um extrato…' : 'Talk to John or attach a statement…'}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none max-h-32"
            />
            <button
              onClick={() => submit()}
              disabled={sending || (!text.trim() && files.length === 0)}
              className="p-2 rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-700"
              aria-label={pt ? 'Enviar' : 'Send'}
            >
              <ArrowUpIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {dragging && (
        <div className="fixed inset-0 z-50 bg-violet-600/20 border-4 border-dashed border-violet-500 flex items-center justify-center pointer-events-none">
          <p className="rounded-xl bg-white dark:bg-gray-800 px-6 py-3 font-bold text-violet-700 dark:text-violet-300">
            {pt ? 'Solte os arquivos aqui' : 'Drop files here'}
          </p>
        </div>
      )}
    </div>
  );
}
