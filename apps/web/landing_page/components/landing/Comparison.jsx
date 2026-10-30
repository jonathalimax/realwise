import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const BEFORE = [
  'Digitar cada gasto na mão, e desistir na segunda semana',
  'Descobrir a conta atrasada quando a multa já chegou',
  'Terminar o mês sem saber para onde o dinheiro foi',
  'Corrigir as mesmas categorias, todo mês, para sempre',
  'Ver uma transferência entre suas contas virar “gasto”',
];

const AFTER = [
  'Mandar o extrato (ou falar) e o Elio lê tudo para você',
  'Receber o lembrete antes de vencer e dar baixa dizendo “paguei”',
  'Ganhar um resumo todo mês, com nota e o que ajustar',
  'Ter categorias que aprendem com as suas correções',
  'Transferências entre as suas contas nunca contam como gasto',
];

export default function Comparison() {
  const reduceMotion = useReducedMotion();
  const fade = (delay) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
  });
  return (
    <section data-section="comparison" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Chega de controle financeiro que dá trabalho</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-300">O que costuma acontecer com planilhas e aplicativos de controle, e o que muda quando quem trabalha é o Elio.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <motion.div {...fade(0)} className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Do jeito de sempre</h3>
            <ul className="mt-5 space-y-4">
              {BEFORE.map((t) => (
                <li key={t} className="flex gap-3 text-slate-600 dark:text-slate-300">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"><X className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...fade(0.12)} className="rounded-3xl border-2 border-violet-500 bg-violet-50/60 p-7 shadow-xl shadow-violet-500/10 dark:bg-violet-950/30">
            <h3 className="text-sm font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">Com o Realwise</h3>
            <ul className="mt-5 space-y-4">
              {AFTER.map((t) => (
                <li key={t} className="flex gap-3 font-medium text-slate-800 dark:text-slate-100">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
