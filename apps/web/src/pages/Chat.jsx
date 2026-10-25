import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownIcon, ArrowUpIcon, PaperClipIcon, XMarkIcon, DocumentTextIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import QuestionSheet from '../components/chat/QuestionSheet';
import ReviewSheet from '../components/chat/ReviewSheet';
import { useSettings } from '../contexts/SettingsContext';
import { chatResource } from '../lib/api/resources/chat';

const SUPPORTED = ['pdf', 'csv', 'tsv', 'txt', 'xlsx', 'xls', 'ofx', 'qif', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;

/** Which sheet (if any) a message is still waiting on. */
function pendingSheet(message) {
  if (Array.isArray(message.questions) && message.questions.some((q) => !q.answer)) return 'questions';
  if (message.review && !message.review.resolved && message.review.groups?.length) return 'review';
  return null;
}

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

function Bubble({ message, onUndo, onOpenSheet, language }) {
  const mine = message.role === 'user';
  const pt = language === 'pt';
  const pending = pendingSheet(message);
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
        {pending && (
          <button
            onClick={() => onOpenSheet(message.id, pending)}
            className="mt-2 w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
          >
            {pending === 'questions'
              ? message.questions.every((q) => q.answer || q.kind === 'confirm')
                ? pt ? 'Revisar e confirmar' : 'Review and confirm'
                : pt ? 'Responder perguntas' : 'Answer questions'
              : pt
                ? `Confirmar categorias (${message.review.groups.length})`
                : `Confirm categories (${message.review.groups.length})`}
          </button>
        )}
        {message.review?.resolved && (
          <p className="mt-2 text-xs font-semibold text-emerald-600">{pt ? '✓ Categorias confirmadas' : '✓ Categories confirmed'}</p>
        )}
      </div>
    </div>
  );
}

/**
 * John's reply while it streams. Network chunks arrive in bursts, so the text is revealed by a
 * frame loop that speeds up when it falls behind: steady character-by-character typing, never a wall of text.
 */
function LiveBubble({ target, status, finished, onRevealed, language }) {
  const pt = language === 'pt';
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const targetRef = useRef(target);
  const finishedRef = useRef(finished);
  const onRevealedRef = useRef(onRevealed);
  const revealedRef = useRef(false);

  useEffect(() => {
    targetRef.current = target;
    finishedRef.current = finished;
    onRevealedRef.current = onRevealed;
  });

  useEffect(() => {
    let raf;
    const tick = () => {
      const full = targetRef.current.length;
      let next = Math.min(shownRef.current, full); // a reset (shorter target) pulls the reveal back
      if (next < full) next += Math.max(1, Math.ceil((full - next) / 12)); // catch up faster the further behind
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
      } else if (finishedRef.current && !revealedRef.current && next >= full) {
        revealedRef.current = true;
        onRevealedRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visible = target.slice(0, shown);

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[88%] sm:max-w-[75%] rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 px-4 py-2.5 text-sm leading-relaxed text-gray-900 dark:text-gray-100 shadow-sm"
        aria-live="polite"
        aria-label={pt ? 'John está escrevendo' : 'John is typing'}
      >
        {visible ? (
          <p className="whitespace-pre-wrap break-words">
            {visible}
            {!finished && <span className="ml-0.5 inline-block w-[2px] h-4 -mb-0.5 bg-violet-500 animate-pulse" />}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {status && <span className="text-xs text-gray-500 dark:text-gray-400">{status}</span>}
          </div>
        )}
        {visible && status && !finished && <p className="mt-1 text-xs text-gray-400">{status}</p>}
      </div>
    </div>
  );
}

const NEAR_BOTTOM_PX = 140;
const isNearBottom = () => document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < NEAR_BOTTOM_PX;
const scrollToBottom = (behavior = 'auto') =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });

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
  const composer = useRef(null);
  const composerBox = useRef(null);
  const listRef = useRef(null);
  const stick = useRef(true); // follow the conversation only while the user is at the bottom
  const [composerHeight, setComposerHeight] = useState(120);
  const [showJump, setShowJump] = useState(false);
  const delivered = useRef(false); // the server persisted the user's message for the current turn
  const [live, setLive] = useState(null); // { text, status, final } while John's reply streams
  const autoSent = useRef(false);
  const [manualSheet, setManualSheet] = useState(null); // { id, type } opened from a button
  const [dismissed, setDismissed] = useState(() => new Set()); // message ids whose sheet the user closed
  const [sheetBusy, setSheetBusy] = useState(false);

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

  // Grow the composer with its content (up to ~6 lines, then it scrolls) so long messages stay readable.
  useEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  // Track whether the user is reading history (scrolled up) or following the conversation.
  useEffect(() => {
    const onScroll = () => {
      const near = isNearBottom();
      stick.current = near;
      setShowJump((prev) => (prev === !near ? prev : !near));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The fixed composer grows with its text/attachments; keep the list's bottom padding in step with it.
  useEffect(() => {
    const el = composerBox.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setComposerHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Open on the latest message, instantly.
  useEffect(() => {
    if (!loading) scrollToBottom('auto');
  }, [loading]);

  // Follow the conversation as it grows, but only while the user is at the bottom. Watching the list's real
  // height (not the incoming text) matters: the typewriter reveals characters a frame after they arrive.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (stick.current) scrollToBottom('auto');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const addFiles = useCallback(
    (list) => {
      const picked = Array.from(list ?? []);
      const ok = picked.filter(
        (f) => SUPPORTED.includes(f.name.split('.').pop()?.toLowerCase() ?? '') && f.size <= MAX_FILE_BYTES,
      );
      if (ok.length < picked.length) {
        setError(
          pt
            ? 'Alguns arquivos foram ignorados. Use PDF, imagem, CSV, XLSX ou OFX de até 15 MB.'
            : 'Some files were skipped. Use PDF, image, CSV, XLSX or OFX up to 15 MB.',
        );
      } else {
        setError('');
      }
      setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
    },
    [pt],
  );

  // The latest assistant message waiting on the user opens its sheet automatically, unless it was closed.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const autoType = lastAssistant ? pendingSheet(lastAssistant) : null;
  const sheet = live
    ? null
    : manualSheet ??
    (lastAssistant && autoType && !dismissed.has(lastAssistant.id) ? { id: lastAssistant.id, type: autoType } : null);
  const sheetMessage = sheet ? messages.find((m) => m.id === sheet.id) : null;

  const closeSheet = () => {
    if (sheet) setDismissed((prev) => new Set(prev).add(sheet.id));
    setManualSheet(null);
  };

  const replaceMessage = (updated) =>
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  // Applies the persisted result once the typewriter has finished revealing the reply.
  const finishLive = useCallback((final) => {
    setMessages((prev) => {
      let next = prev;
      if (final.questionsMessage) next = next.map((m) => (m.id === final.questionsMessage.id ? final.questionsMessage : m));
      if (!next.some((m) => m.id === final.assistantMessage.id)) next = [...next, final.assistantMessage];
      return next;
    });
    setLive(null);
    setSending(false);
  }, []);

  /** Runs one streamed turn: `start(onEvent)` performs the request; events drive the live bubble. */
  const runTurn = useCallback(
    async (start, optimisticId) => {
      stick.current = true; // the user just acted: follow the reply
      delivered.current = false;
      setLive({ text: '', status: '', final: null });
      const final = await start((event) => {
        if (event.type === 'user') {
          delivered.current = true;
          setMessages((prev) => [...prev.filter((m) => m.id !== optimisticId), event.message]);
        } else if (event.type === 'delta') {
          setLive((prev) => (prev ? { ...prev, text: prev.text + event.text, status: '' } : prev)); // the answer started: drop the status line
        } else if (event.type === 'reset') {
          setLive((prev) => (prev ? { ...prev, text: '' } : prev));
        } else if (event.type === 'status') {
          setLive((prev) => (prev ? { ...prev, status: event.label } : prev));
        }
      });
      // Show the persisted text (it may differ from what streamed, e.g. a default reply) and let it finish typing.
      setLive((prev) => ({ ...(prev ?? { status: '' }), text: final.assistantMessage.content, status: '', final }));
    },
    [],
  );

  const submitAnswers = async (answers) => {
    setSheetBusy(true);
    setSending(true);
    setError('');
    const id = sheetMessage.id;
    setManualSheet(null);
    try {
      await runTurn((onEvent) => chatResource.answerStream(id, answers, onEvent), null);
    } catch (e) {
      setLive(null);
      setSending(false);
      setManualSheet({ id, type: 'questions' });
      setError(e?.message || (pt ? 'Não consegui enviar as respostas.' : 'Could not send your answers.'));
    } finally {
      setSheetBusy(false);
    }
  };

  const submitReview = async (decisions) => {
    setSheetBusy(true);
    setError('');
    try {
      const { message } = await chatResource.applyReview(sheetMessage.id, decisions);
      setManualSheet(null);
      replaceMessage(message);
    } catch (e) {
      setError(e?.message || (pt ? 'Não consegui salvar as categorias.' : 'Could not save the categories.'));
    } finally {
      setSheetBusy(false);
    }
  };

  const submit = useCallback(
    async (overrideText) => {
      const message = (overrideText ?? text).trim();
      if ((!message && files.length === 0) || sending) return;
      const attached = files;
      setError('');
      setSending(true);
      setText('');
      setFiles([]);
      // Optimistic user bubble, replaced by the persisted one when the server confirms it.
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: message || (pt ? '(arquivos anexados)' : '(attached files)'),
        attachments: attached.map((f) => ({ name: f.name })),
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        await runTurn((onEvent) => chatResource.sendStream({ message, files: attached, onEvent }), optimistic.id);
      } catch (e) {
        setLive(null);
        setSending(false);
        if (delivered.current) {
          // The server already saved the message: keep it and don't refill the composer (it would be sent twice).
          setError(pt ? 'O John não conseguiu responder agora. Tente enviar de novo em instantes.' : 'John could not reply right now. Please try again shortly.');
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          setText(message);
          setFiles(attached);
          setError(e?.message || (pt ? 'Algo deu errado. Tente novamente.' : 'Something went wrong. Please try again.'));
        }
      }
    },
    [text, files, sending, pt, runTurn],
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

      <div ref={listRef} className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 space-y-3" style={{ paddingBottom: composerHeight + 24 }}>
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
            onOpenSheet={(id, type) => setManualSheet({ id, type })}
            onUndo={async (importId) => {
              await chatResource.undoImport(importId);
            }}
          />
        ))}

        {live && (
          <LiveBubble
            target={live.text}
            status={live.status}
            finished={Boolean(live.final)}
            onRevealed={() => live.final && finishLive(live.final)}
            language={language}
          />
        )}
      </div>

      <div ref={composerBox} className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-gradient-to-t from-gray-50 via-gray-50 dark:from-gray-900 dark:via-gray-900 to-transparent pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto relative">
          {showJump && (
            <button
              onClick={() => {
                stick.current = true;
                scrollToBottom('smooth');
              }}
              className="absolute -top-12 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-gray-800 text-violet-600 shadow-lg ring-1 ring-black/5"
              aria-label={pt ? 'Ir para a última mensagem' : 'Jump to latest message'}
            >
              <ArrowDownIcon className="w-5 h-5" />
            </button>
          )}
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
            {/* A <label> around the input opens the picker in every browser (hidden-input .click() is unreliable on iOS and in-app browsers). No `accept` filter: some mobile pickers grey out unusual extensions; unsupported files are rejected below with a clear message. */}
            <label
              className="p-2 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 cursor-pointer"
              aria-label={pt ? 'Anexar arquivos' : 'Attach files'}
            >
              <PaperClipIcon className="w-6 h-6" />
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <textarea
              ref={composer}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={pt ? 'Fale com o John ou anexe um extrato…' : 'Talk to John or attach a statement…'}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-base sm:text-sm leading-snug text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none overflow-y-auto"
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

      {sheetMessage && sheet.type === 'questions' && (
        <QuestionSheet key={sheetMessage.id} message={sheetMessage} language={language} busy={sheetBusy} onSubmit={submitAnswers} onClose={closeSheet} />
      )}
      {sheetMessage && sheet.type === 'review' && (
        <ReviewSheet key={sheetMessage.id} message={sheetMessage} language={language} busy={sheetBusy} onApply={submitReview} onClose={closeSheet} />
      )}

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
