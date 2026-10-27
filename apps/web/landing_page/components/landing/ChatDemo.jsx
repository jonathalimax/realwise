import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { FileText, Paperclip, Send } from 'lucide-react';

/**
 * Self-playing demo of the product: drop a statement, Elio reads and organises it, then answers a question.
 * It loops while visible, pauses when scrolled away, and shows the finished conversation (no motion) when the
 * visitor prefers reduced motion.
 */

const SUMMARY = {
  total: 3482.1,
  count: 28,
  rows: [
    { label: 'Moradia', value: 1200, color: 'bg-indigo-500' },
    { label: 'Mercado', value: 912, color: 'bg-emerald-500' },
    { label: 'Delivery', value: 640, color: 'bg-orange-500' },
    { label: 'Transporte', value: 340, color: 'bg-sky-500' },
  ],
};

// `at` = ms after the loop starts when the item appears.
const SCRIPT = [
  { id: 'hi', type: 'elio', at: 300, text: 'Oi! Eu sou o Elio 💜 Mande seu extrato ou fatura que eu organizo tudo.' },
  { id: 'file', type: 'file', at: 2600, name: 'Fatura_Nubank_Out.pdf' },
  { id: 'typing1', type: 'typing', at: 3800 },
  { id: 'read', type: 'elio', at: 5000, text: `Li sua fatura: ${SUMMARY.count} lançamentos no Nubank Cartão. Já categorizei tudo ✨` },
  { id: 'summary', type: 'summary', at: 7600 },
  { id: 'ask', type: 'user', at: 10600, text: 'Onde posso economizar?' },
  { id: 'typing2', type: 'typing', at: 11600 },
  { id: 'tip', type: 'elio', at: 12800, text: 'Delivery subiu 34% desde setembro. Cortar 2 pedidos por semana economiza cerca de R$ 180 por mês.' },
];
const LOOP_MS = 20500;

const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Reveals text a couple of characters at a time, like Elio's real replies stream in. */
function Typed({ text, instant }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (instant) return undefined;
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      setCount(Math.min(i, text.length));
      if (i >= text.length) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [text, instant]);
  return <>{instant ? text : text.slice(0, count)}</>;
}

function CountUp({ value, instant }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (instant) return undefined;
    const controls = animate(0, value, { duration: 1.3, ease: 'easeOut', onUpdate: setShown });
    return () => controls.stop();
  }, [value, instant]);
  return <>{brl(instant ? value : shown)}</>;
}

function ElioBubble({ children }) {
  return (
    <div className="max-w-[86%] self-start">
      <span className="mb-0.5 block text-[10px] font-bold text-violet-600 dark:text-violet-400">Elio</span>
      <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 px-3.5 py-2 text-[13px] leading-snug text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700">
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ instant }) {
  const max = Math.max(...SUMMARY.rows.map((r) => r.value));
  return (
    <div className="w-[92%] self-start rounded-2xl bg-white dark:bg-slate-800 p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{SUMMARY.count} lançamentos</span>
        <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
          <CountUp value={SUMMARY.total} instant={instant} />
        </span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {SUMMARY.rows.map((row, i) => (
          <li key={row.label} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="w-16 shrink-0">{row.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <motion.span
                className={`block h-full rounded-full ${row.color}`}
                initial={{ width: instant ? `${(row.value / max) * 100}%` : 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ duration: 0.8, delay: instant ? 0 : 0.25 + i * 0.12, ease: 'easeOut' }}
              />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums">{brl(row.value).replace(',00', '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderItem(item, instant) {
  switch (item.type) {
    case 'elio':
      return (
        <ElioBubble>
          <Typed text={item.text} instant={instant} />
        </ElioBubble>
      );
    case 'file':
      return (
        <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-violet-600 px-3 py-2 text-white shadow-sm">
          <span className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[11px]">
            <FileText className="h-3.5 w-3.5" />
            {item.name}
          </span>
        </div>
      );
    case 'user':
      return <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2 text-[13px] text-white shadow-sm">{item.text}</div>;
    case 'typing':
      return (
        <ElioBubble>
          <span className="flex gap-1 py-1" aria-label="Elio está escrevendo">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-violet-400"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </span>
        </ElioBubble>
      );
    case 'summary':
      return <SummaryCard instant={instant} />;
    default:
      return null;
  }
}

export default function ChatDemo({ className = '' }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduceMotion || !inView) return undefined;
    const timers = [];
    const play = () => {
      timers.push(setTimeout(() => setShown(0), 0));
      SCRIPT.forEach((item, i) => timers.push(setTimeout(() => setShown(i + 1), item.at)));
      timers.push(setTimeout(play, LOOP_MS));
    };
    play();
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, inView]);

  const count = reduceMotion ? SCRIPT.length : shown;
  // A typing indicator only lives until the next message arrives.
  const items = SCRIPT.slice(0, count).filter((item, i) => item.type !== 'typing' || i === count - 1);
  // With reduced motion show the finished conversation, without the transient typing bubbles.
  const visible = reduceMotion ? SCRIPT.filter((s) => s.type !== 'typing') : items;

  return (
    <div ref={ref} className={`relative mx-auto w-full max-w-[320px] ${className}`} aria-label="Demonstração: o Elio organizando uma fatura" role="img">
      <div className="rounded-[2.4rem] border-[7px] border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-2xl shadow-violet-500/20 overflow-hidden">
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[11px] font-bold text-white">J</span>
            <span className="text-xs font-bold tracking-wide text-slate-900 dark:text-white">ASSISTENTE IA</span>
          </div>
          <span className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="flex h-[400px] flex-col justify-end gap-2.5 overflow-hidden px-3 pb-3 pt-3">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((item) => (
              <motion.div
                key={item.id}
                layout="position"
                className="flex flex-col"
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                {renderItem(item, Boolean(reduceMotion))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5">
          <Paperclip className="h-4 w-4 text-slate-400" />
          <span className="flex-1 truncate text-xs text-slate-400">Como posso te ajudar?</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
