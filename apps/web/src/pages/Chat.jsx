import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownIcon, ArrowUpIcon, PaperClipIcon, XMarkIcon, DocumentTextIcon, ArrowUturnLeftIcon, MicrophoneIcon, SpeakerWaveIcon, StopIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import QuestionSheet from '../components/chat/QuestionSheet';
import ReviewSheet from '../components/chat/ReviewSheet';
import AccountFormSheet from '../components/chat/AccountFormSheet';
import BillsSheet from '../components/chat/BillsSheet';
import Markdown from '../components/chat/Markdown';
import FilePreview from '../components/chat/FilePreview';
import { notifyTransactionsChanged } from '../lib/api/resources/transactions';
import { notifyBillsChanged } from '../lib/api/resources/bills';
import { useSettings } from '../contexts/SettingsContext';
import { friendlyChatError } from '../lib/chatErrors';
import { chatResource } from '../lib/api/resources/chat';
import { purgeOldFiles, recallFile, rememberFiles } from '../lib/chatFileCache';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import useSpeechSynthesis from '../hooks/useSpeechSynthesis';

const SUPPORTED = ['pdf', 'csv', 'tsv', 'txt', 'xlsx', 'xls', 'ofx', 'qif', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;

/** Which sheet (if any) a message is still waiting on. */
function pendingSheet(message) {
  if (Array.isArray(message.questions) && message.questions.some((q) => !q.answer && q.kind === 'account_form')) return 'account_form';
  // `quick` questions are chips under the message, not a sheet.
  if (Array.isArray(message.questions) && message.questions.some((q) => !q.answer && q.kind !== 'quick')) return 'questions';
  if (message.review && !message.review.resolved && message.review.groups?.length) return 'review';
  if (message.billsPanel && !message.billsPanel.resolved && message.billsPanel.items?.length) return 'bills';
  return null;
}

const brl = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const BAR_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-sky-500'];

/** Summary of an import: totals plus the biggest expense categories as animated bars, with Undo. */
function SavedCard({ saved, onUndo, language }) {
  const [state, setState] = useState('idle'); // idle | undoing | undone | error
  const [grown, setGrown] = useState(false); // flips after mount so the bars animate from 0
  const pt = language === 'pt';
  const rows = Array.isArray(saved.topCategories) ? saved.topCategories : [];
  const max = Math.max(1, ...rows.map((r) => r.total));

  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);

  const undo = async () => {
    setState('undoing');
    try {
      await onUndo(saved.importId);
      setState('undone');
    } catch {
      setState('error');
    }
  };

  const notes = [
    saved.income > 0 && `${pt ? 'Entradas' : 'Income'} ${brl(saved.income)}`,
    saved.duplicatesSkipped > 0 && `${saved.duplicatesSkipped} ${pt ? 'duplicadas ignoradas' : 'duplicates skipped'}`,
    saved.transfers > 0 && `${saved.transfers} ${pt ? 'transferências entre contas (fora dos totais)' : 'transfers between accounts (not in totals)'}`,
  ].filter(Boolean);

  return (
    <div className="mt-2 rounded-2xl bg-white dark:bg-gray-800 p-3.5 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {saved.saved} {pt ? 'lançamentos em' : 'entries in'} {saved.accountName}
        </span>
        {saved.expense > 0 && <span className="shrink-0 text-base font-bold tabular-nums text-gray-900 dark:text-white">{brl(saved.expense)}</span>}
      </div>
      {rows.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {rows.map((row, i) => (
            <li key={row.name} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span className="w-20 shrink-0 truncate">{row.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <span
                  className={`block h-full rounded-full transition-[width] duration-700 ease-out ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: grown ? `${(row.total / max) * 100}%` : '0%', transitionDelay: `${i * 110}ms` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums">{brl(row.total).replace(',00', '')}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
        <p className="min-w-0 text-gray-500 dark:text-gray-400">{notes.join(' · ')}</p>
        {state === 'undone' ? (
          <span className="shrink-0 font-bold text-gray-500">{pt ? 'Desfeito' : 'Undone'}</span>
        ) : (
          <button
            onClick={undo}
            disabled={state === 'undoing'}
            className="shrink-0 inline-flex items-center gap-1 font-bold text-violet-700 dark:text-violet-300 hover:underline disabled:opacity-50"
          >
            <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
            {state === 'error' ? (pt ? 'Tentar de novo' : 'Retry') : pt ? 'Desfazer' : 'Undo'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Older confirmations were saved with technical text (ids, JSON results); show them as the plain answer they were. */
function cleanUserText(text) {
  if (/o usuário CONFIRMOU/.test(text)) return 'Sim, pode alterar ✅';
  if (/o usuário CANCELOU/.test(text)) return 'Cancelar';
  return text.replace(/\s*\((accountId|paymentMethod) [^)]*\)/g, '');
}

function Bubble({ message, onUndo, onOpenSheet, onPreviewFile, onSpeak, speaking, language }) {
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
        {!mine && (
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-violet-600 dark:text-violet-400">Elio</p>
            {onSpeak && message.content && !message.local && (
              <button
                type="button"
                onClick={() => onSpeak(message)}
                aria-label={speaking ? (pt ? 'Parar de ler' : 'Stop reading') : pt ? 'Ouvir esta resposta' : 'Read this reply aloud'}
                aria-pressed={speaking}
                className={`-mr-1.5 -mt-0.5 rounded-full p-1.5 transition-colors ${speaking ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' : 'text-gray-400 hover:text-violet-600 dark:hover:text-violet-300'}`}
              >
                {speaking ? <StopIcon className="h-4 w-4" /> : <SpeakerWaveIcon className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((file, i) => (
              <button
                key={`${file.name}-${i}`}
                type="button"
                onClick={() => onPreviewFile?.(message.id, file.name)}
                disabled={!onPreviewFile || String(message.id).startsWith('tmp-')}
                aria-label={`${pt ? 'Ver' : 'View'} ${file.name}`}
                className="inline-flex items-center gap-1 rounded-lg bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs hover:bg-black/20 dark:hover:bg-white/20 disabled:cursor-default"
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                <span className="max-w-[10rem] truncate">{file.name}</span>
              </button>
            ))}
          </div>
        )}
        {mine ? <p className="whitespace-pre-wrap break-words">{cleanUserText(message.content)}</p> : <Markdown text={message.content} />}
        {Array.isArray(message.saved) &&
          message.saved.map((saved) => (
            <SavedCard key={saved.importId} saved={saved} onUndo={onUndo} language={language} />
          ))}
        {pending && (
          <button
            onClick={() => onOpenSheet(message.id, pending)}
            className="mt-2 w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
          >
            {pending === 'account_form'
              ? pt ? 'Cadastrar conta ou cartão' : 'Add account or card'
              : pending === 'questions'
              ? message.questions.every((q) => q.answer || q.kind === 'confirm')
                ? pt ? 'Revisar e confirmar' : 'Review and confirm'
                : pt ? 'Responder perguntas' : 'Answer questions'
              : pending === 'bills'
              ? 'Marcar contas pagas'
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
 * Elio's reply while it streams. Network chunks arrive in bursts, so the text is revealed by a
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
        aria-label={pt ? 'O assistente está escrevendo' : 'The assistant is typing'}
      >
        <p className="mb-0.5 text-[11px] font-bold text-violet-600 dark:text-violet-400">Elio</p>
        {visible ? (
          <div>
            <Markdown text={visible} streaming={!finished} />
            {!finished && <span className="inline-block w-[2px] h-4 -mb-0.5 bg-violet-500 animate-pulse" />}
          </div>
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

/**
 * The element that actually scrolls the page. On iOS, index.css gives html and body `height: 100%; overflow: auto`,
 * which turns <body> into the scroll container (window.scrollY stays 0 and documentElement.scrollHeight is just the
 * viewport). Everywhere else the window scrolls. Never assume `window`: scrolling it on iOS does nothing.
 */
function pageScroller() {
  const { body } = document;
  if (body.scrollHeight > body.clientHeight + 1 && ['auto', 'scroll', 'hidden'].includes(getComputedStyle(body).overflowY)) return body;
  return document.scrollingElement || document.documentElement;
}
const isNearBottom = () => {
  const el = pageScroller();
  const viewport = el === document.body ? el.clientHeight : window.innerHeight;
  const top = el === document.body ? el.scrollTop : window.scrollY;
  return el.scrollHeight - (top + viewport) < NEAR_BOTTOM_PX;
};
const scrollToBottom = (behavior = 'auto') => {
  const el = pageScroller();
  if (el === document.body) el.scrollTo({ top: el.scrollHeight, behavior });
  else window.scrollTo({ top: el.scrollHeight, behavior });
};

export default function ChatPage() {
  const { language } = useSettings();
  const pt = language === 'pt';
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Failures are posted as a friendly message from Elio (local only, never saved or sent to the model).
  const say = useCallback(
    (content) => setMessages((prev) => [...prev, { id: `local-${Date.now()}-${prev.length}`, role: 'assistant', content, local: true }]),
    [],
  );
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null); // an attached file opened read-only
  const speechLang = pt ? 'pt-BR' : 'en-US';
  const reader = useSpeechSynthesis({ lang: speechLang }); // read Elio's replies aloud
  const [dragging, setDragging] = useState(false);
  const composer = useRef(null);
  const composerBox = useRef(null);
  const listRef = useRef(null);
  const stick = useRef(true); // follow the conversation only while the user is at the bottom
  const pinUntil = useRef(0); // until this time, opening the chat keeps pinning to the bottom
  const hadSheet = useRef(false);
  const [showJump, setShowJump] = useState(false);
  const delivered = useRef(false); // the server persisted the user's message for the current turn
  const deliveredId = useRef(null); // id of that persisted message
  const [live, setLive] = useState(null); // { text, status, final } while Elio's reply streams
  const autoSent = useRef(false);
  const onboardingStarted = useRef(false);
  const [manualSheet, setManualSheet] = useState(null); // { id, type } opened from a button
  const [dismissed, setDismissed] = useState(() => new Set()); // message ids whose sheet the user closed
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    purgeOldFiles();
  }, []);

  useEffect(() => {
    let active = true;
    chatResource
      .messages()
      .then((rows) => active && setMessages(Array.isArray(rows) ? rows : []))
      .catch(() => active && say('Não consegui carregar a conversa agora. Atualize a página em instantes.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [say]);

  // A user with no bank account is set up by Elio: the first open creates the default categories and posts his
  // welcome with the account form. The server makes this idempotent; the ref avoids a duplicate call in StrictMode.
  useEffect(() => {
    if (loading || onboardingStarted.current) return;
    onboardingStarted.current = true;
    chatResource
      .onboardingStart()
      .then((res) => {
        if (res?.message) setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      })
      .catch(() => {});
  }, [loading]);

  // Grow the composer with its content (up to ~6 lines, then it scrolls) so long messages stay readable.
  useEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  // Track whether the user is reading history (scrolled up) or following the conversation.
  useEffect(() => {
    // Capture phase: scroll events of <body> (the iOS scroll container) do not bubble up to the window.
    const onScroll = (e) => {
      if (e.target !== document && e.target !== document.body && e.target !== document.documentElement) return; // an inner scroller (composer, sheet)
      if (Date.now() < pinUntil.current) return; // our own pinning, not the user reading history
      const near = isNearBottom();
      stick.current = near;
      setShowJump((prev) => (prev === !near ? prev : !near));
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  // iOS can leave the page laid out for a keyboard/picker that is already gone (blank or black area, composer floating
  // mid-screen). When the visual viewport is much shorter than the window and nothing is focused, nudge a relayout.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const recover = () => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (!typing && vv.height < window.innerHeight * 0.75) {
        window.scrollTo(window.scrollX, window.scrollY);
        if (stick.current) scrollToBottom('auto');
      }
    };
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(recover, 350);
    };
    vv.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      vv.removeEventListener('resize', onResize);
    };
  }, []);

  // Open on the latest message. Layout keeps settling for a moment after the list renders (markdown, fonts, cards,
  // the auto-opened sheet), so keep re-pinning to the bottom for ~1s, unless the user starts scrolling themselves.
  useEffect(() => {
    if (loading) return undefined;
    stick.current = true;
    pinUntil.current = Date.now() + 1200;
    let frame;
    const pin = () => {
      if (Date.now() > pinUntil.current) return;
      scrollToBottom('auto');
      frame = requestAnimationFrame(pin);
    };
    pin();
    const stop = () => {
      pinUntil.current = 0;
    };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
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
        say('Alguns arquivos foram ignorados. Envie PDF, imagem, CSV, XLSX ou OFX de até 15 MB cada.');
      }
      setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
    },
    [say],
  );

  // The latest assistant message waiting on the user opens its sheet automatically, unless it was closed.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.local);
  const autoType = lastAssistant ? pendingSheet(lastAssistant) : null;
  const sheet = live
    ? null
    : manualSheet ??
    (lastAssistant && autoType && !dismissed.has(lastAssistant.id) ? { id: lastAssistant.id, type: autoType } : null);
  const sheetMessage = sheet ? messages.find((m) => m.id === sheet.id) : null;
  // Quick-reply chips belong to the very last message, and vanish as soon as the user answers (by tap or typing).
  const lastMessage = messages[messages.length - 1];
  const quickChips =
    lastMessage && lastMessage.role === 'assistant' && !lastMessage.local && Array.isArray(lastMessage.questions)
      ? lastMessage.questions.find((q) => q.kind === 'quick' && !q.answer)?.options ?? []
      : [];

  // A sheet locks the page's scroll while it is open. When it closes, make sure the view is on the latest message
  // if the user was following the chat.
  const sheetOpen = Boolean(sheet);
  useEffect(() => {
    if (!sheetOpen && hadSheet.current && stick.current) scrollToBottom('auto');
    hadSheet.current = sheetOpen;
  }, [sheetOpen]);

  // Tap an attachment in a message already sent: reopen it from this device's copy (the server keeps none).
  const previewSentFile = useCallback(
    async (messageId, name) => {
      const file = await recallFile(messageId, name);
      if (file) setPreviewFile(file);
      else say('Não tenho mais esse arquivo guardado neste aparelho. Os anexos ficam disponíveis por 3 dias, só no aparelho em que foram enviados.');
    },
    [say],
  );

  // Dictation: the words land in the composer as they are recognised; the user reviews them and sends.
  const dictation = useSpeechRecognition({
    lang: speechLang,
    onTranscript: setText,
    onError: (code) => {
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        say('O navegador não liberou o microfone. Permita o acesso ao microfone nas configurações do site e tente de novo.');
      } else if (code === 'audio-capture') {
        say('Não encontrei um microfone neste aparelho.');
      } else if (code === 'network') {
        say('O reconhecimento de voz do navegador ficou sem conexão agora. Você pode digitar ou tentar de novo em instantes.');
      } else {
        say('Não consegui usar a voz agora. Você pode digitar sua mensagem.');
      }
    },
  });
  const toggleDictation = () => {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    reader.stop(); // do not let Elio's voice feed back into the microphone
    composer.current?.blur(); // keep the phone keyboard out of the way while speaking
    dictation.start(text);
  };

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
    async (start, optimisticId, sentFiles) => {
      stick.current = true; // the user just acted: follow the reply
      delivered.current = false;
      deliveredId.current = null;
      setLive({ text: '', status: '', final: null });
      const final = await start((event) => {
        if (event.type === 'user') {
          delivered.current = true;
          deliveredId.current = event.message?.id ?? null;
          if (sentFiles?.length && event.message?.id) rememberFiles(event.message.id, sentFiles);
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

  /**
   * The connection broke after the server saved the user's message (long runs on mobile networks, or the app was
   * backgrounded). The server finishes the work and saves the reply regardless, so wait for it instead of failing.
   */
  const recoverAfterDrop = useCallback(async () => {
    setLive({ text: '', status: pt ? 'Ainda estou trabalhando nisso…' : 'Still working on it…', final: null });
    const deadline = Date.now() + 4 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      try {
        const rows = await chatResource.messages();
        const at = rows.findIndex((m) => m.id === deliveredId.current);
        if (at >= 0 && rows.slice(at + 1).some((m) => m.role === 'assistant')) {
          setMessages(rows);
          setLive(null);
          setSending(false);
          notifyTransactionsChanged();
          notifyBillsChanged();
          return;
        }
      } catch {
        /* offline for a moment: keep trying */
      }
    }
    setLive(null);
    setSending(false);
    say('Estou demorando mais que o normal para responder. Atualize a página em instantes para ver a resposta.');
  }, [pt, say]);

  const submitAnswers = async (answers) => {
    setSheetBusy(true);
    setSending(true);
    const id = sheetMessage.id;
    setManualSheet(null);
    try {
      await runTurn((onEvent) => chatResource.answerStream(id, answers, onEvent), null);
    } catch (e) {
      if (delivered.current) {
        await recoverAfterDrop();
        return;
      }
      setLive(null);
      setSending(false);
      setDismissed((prev) => new Set(prev).add(id));
      say(`${friendlyChatError(e)} Toque em "Responder perguntas" para tentar de novo.`);
    } finally {
      setSheetBusy(false);
    }
  };

  const submitAccountForm = async (form) => {
    setSheetBusy(true);
    setSending(true);
    const id = sheetMessage.id;
    try {
      await runTurn((onEvent) => chatResource.accountFormStream(id, form, onEvent), null);
    } catch (e) {
      if (delivered.current) {
        await recoverAfterDrop();
        return;
      }
      setLive(null);
      setSending(false);
      setDismissed((prev) => new Set(prev).add(id));
      say(`${friendlyChatError(e)} Toque em "Responder perguntas" para tentar de novo.`);
    } finally {
      setSheetBusy(false);
    }
  };

  const submitBills = async (items) => {
    setSheetBusy(true);
    try {
      const { panelMessage, assistantMessage } = await chatResource.settleBills(sheetMessage.id, items);
      setManualSheet(null);
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === panelMessage.id ? panelMessage : m));
        return next.some((m) => m.id === assistantMessage.id) ? next : [...next, assistantMessage];
      });
      stick.current = true;
    } catch (e) {
      setManualSheet(null);
      setDismissed((prev) => new Set(prev).add(sheetMessage.id));
      say(`${friendlyChatError(e)} Toque em "Marcar contas pagas" para tentar de novo.`);
    } finally {
      setSheetBusy(false);
    }
  };

  const submitReview = async (decisions) => {
    setSheetBusy(true);
    try {
      const { message } = await chatResource.applyReview(sheetMessage.id, decisions);
      setManualSheet(null);
      replaceMessage(message);
    } catch (e) {
      setManualSheet(null);
      say(friendlyChatError(e, 'Não consegui salvar as categorias agora. Tente de novo em instantes.'));
    } finally {
      setSheetBusy(false);
    }
  };

  const submit = useCallback(
    async (overrideText) => {
      const message = (overrideText ?? text).trim();
      if ((!message && files.length === 0) || sending) return;
      const attached = files;
      dictation.stop();
      reader.stop();
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
        await runTurn((onEvent) => chatResource.sendStream({ message, files: attached, onEvent }), optimistic.id, attached);
      } catch (e) {
        if (delivered.current) {
          // The server already saved the message (and keeps working): wait for its reply, never refill the composer.
          await recoverAfterDrop();
          return;
        }
        // Never reached the server: put everything back so the user can retry.
        setLive(null);
        setSending(false);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setText(message);
        setFiles(attached);
        say(friendlyChatError(e));
      }
    },
    [text, files, sending, pt, runTurn, recoverAfterDrop, say, dictation, reader],
  );

  // Opened from an email: ?intent=bills (settle pending bills) or ?suggestion=<id> (Elio creates the suggested reminder).
  const deepLinkDone = useRef(false);
  useEffect(() => {
    const intent = searchParams.get('intent');
    const suggestion = searchParams.get('suggestion');
    if (loading || deepLinkDone.current || (!intent && !suggestion)) return;
    deepLinkDone.current = true;
    setSearchParams({}, { replace: true });
    const run = suggestion ? chatResource.suggestionIntent(suggestion) : chatResource.billsIntent();
    run
      .then(({ message }) => {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev.map((m) => (m.id === message.id ? message : m)) : [...prev, message]));
        stick.current = true;
        if (suggestion) notifyBillsChanged();
      })
      .catch((e) => say(friendlyChatError(e, 'Não consegui abrir isso agora. Tente de novo em instantes ou me conte por aqui.')));
  }, [searchParams, loading, setSearchParams, say]);

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
      <PageHeader title={pt ? 'Assistente IA' : 'AI Assistant'} />

      {previewFile && <FilePreview file={previewFile} language={language} onClose={() => setPreviewFile(null)} />}

      <div ref={listRef} className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 space-y-3" style={{ paddingBottom: 16 }}>
        {!loading && messages.length === 0 && (
          <div className="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm text-sm text-gray-700 dark:text-gray-300 space-y-3">
            <p className="font-bold text-gray-900 dark:text-white">
              {pt ? 'Oi, eu sou o Elio, seu assistente financeiro. Vamos cuidar bem do seu dinheiro? 💜' : "Hi, I'm Elio, your financial assistant. Let's take good care of your money 💜"}
            </p>
            <p>
              {pt
                ? 'Envie seus extratos, faturas e comprovantes (PDFs, planilhas ou fotos, vários de uma vez) que eu organizo tudo e descubro a conta de cada um. Você também pode escrever "gastei 45 no mercado", cadastrar uma conta a pagar ou me perguntar qualquer coisa sobre suas finanças.'
                : 'Send your statements, invoices and receipts (PDFs, spreadsheets or photos, several at once) and I will organise everything and work out which account each belongs to. You can also type "spent 45 at the market", add a bill, or ask me anything about your finances.'}
            </p>
            <p className="text-xs text-gray-400">
              {pt ? 'Para economizar, esta conversa é limpa a cada 3 dias. Seus dados continuam salvos.' : 'To save resources, this conversation clears every 3 days. Your data stays saved.'}
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
            onPreviewFile={previewSentFile}
            onSpeak={reader.supported ? (m) => (reader.speakingId === m.id ? reader.stop() : reader.speak(m.id, m.content)) : undefined}
            speaking={reader.speakingId === m.id}
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

      <div ref={composerBox} className="sticky bottom-0 z-30 bg-gradient-to-t from-gray-50 via-gray-50 dark:from-gray-900 dark:via-gray-900 to-transparent pt-6 pb-4 px-4">
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
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((file, i) => (
                <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="inline-flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-300"
                    aria-label={`${pt ? 'Ver' : 'View'} ${file.name}`}
                  >
                    <DocumentTextIcon className="w-4 h-4 text-violet-500" />
                    <span className="max-w-[10rem] truncate underline-offset-2 hover:underline">{file.name}</span>
                  </button>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label={pt ? 'Remover' : 'Remove'}>
                    <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {dictation.listening && (
            <p role="status" className="mb-2 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              {pt ? 'Ouvindo em português… toque no microfone para parar.' : 'Listening… tap the microphone to stop.'}
            </p>
          )}
          {!live && !sending && quickChips.length > 0 && (
            <div className="mb-2 flex flex-nowrap gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={pt ? 'Respostas rápidas' : 'Quick replies'}>
              {quickChips.map((chip, i) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => submit(chip.label)}
                  className={`shrink-0 snap-start whitespace-nowrap rounded-full border font-semibold transition-colors ${
                    i === quickChips.length - 1
                      ? 'border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'border-violet-300 dark:border-violet-700 px-3.5 py-2 text-sm text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-2">
            {/* A <label> around the input opens the picker in every browser (hidden-input .click() is unreliable on iOS and in-app browsers). No `accept` filter: some mobile pickers grey out unusual extensions; unsupported files are rejected below with a clear message. */}
            <label
              className="p-2 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 cursor-pointer"
              aria-label={pt ? 'Anexar arquivos' : 'Attach files'}
              // Close the keyboard before the native picker opens, so iOS has no keyboard state to get stuck on.
              onClick={() => composer.current?.blur()}
            >
              <PaperClipIcon className="w-6 h-6" />
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                  composer.current?.blur();
                  // Let the picker sheet finish closing, then re-sync the layout with the real viewport.
                  setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), 350);
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
              placeholder={pt ? 'Como posso te ajudar?' : 'How can I help you?'}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-base sm:text-sm leading-snug text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none overflow-y-auto"
            />
            {dictation.supported && (
              <button
                type="button"
                onClick={toggleDictation}
                disabled={sending}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? (pt ? 'Parar o ditado' : 'Stop dictation') : pt ? 'Ditar por voz' : 'Dictate'}
                className={`p-2 rounded-xl transition-colors disabled:opacity-40 ${
                  dictation.listening ? 'bg-rose-500 text-white animate-pulse' : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30'
                }`}
              >
                <MicrophoneIcon className="w-6 h-6" />
              </button>
            )}
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
      {sheetMessage && sheet.type === 'account_form' && (
        <AccountFormSheet key={sheetMessage.id} message={sheetMessage} language={language} busy={sheetBusy} onSubmit={submitAccountForm} onClose={closeSheet} />
      )}
      {sheetMessage && sheet.type === 'bills' && (
        <BillsSheet key={sheetMessage.id} message={sheetMessage} busy={sheetBusy} onSubmit={submitBills} onClose={closeSheet} />
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
