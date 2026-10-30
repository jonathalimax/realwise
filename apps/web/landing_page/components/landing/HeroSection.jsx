import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, ShieldCheck } from 'lucide-react';
import CtaButton from './CtaButton';
import { landingAnalytics } from '../../landingAnalytics';
import ChatDemo from './ChatDemo';

const goToLogin = (label) => {
  landingAnalytics.trackCtaClicked(label, 'hero');
  sessionStorage.setItem('__rw_show_login', '1');
  window.location.href = '/login';
};

export default function HeroSection() {
  const reduceMotion = useReducedMotion();
  const rise = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <section data-section="hero" className="relative overflow-hidden px-6 pt-10 pb-20 sm:pt-16 lg:pt-20">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-violet-50/70 via-white to-white dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900" />
      {!reduceMotion && (
        <>
          <motion.div
            aria-hidden
            className="absolute -top-24 left-1/4 -z-10 h-80 w-80 rounded-full bg-violet-300/25 dark:bg-violet-500/15 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 9, repeat: Infinity }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-0 right-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-300/20 dark:bg-indigo-500/10 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 7, repeat: Infinity, delay: 1 }}
          />
        </>
      )}

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="text-center lg:text-left">
          <motion.span
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-white/70 dark:bg-slate-800/60 px-3.5 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 7 dias grátis · sem cartão e sem pagar nada
          </motion.span>

          <motion.h1 {...rise(0.08)} className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Diga seus objetivos.
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">O Elio cuida do resto.</span>
          </motion.h1>

          <motion.p {...rise(0.16)} className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300 lg:mx-0">
            Seu assistente financeiro com IA. Fale ou escreva o que você quer conquistar e ele monta seu plano, lê seus extratos e
            faturas, lembra suas contas e, todo mês, mostra para onde seu dinheiro foi.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
            <CtaButton onClick={() => goToLogin('Começar grátis')}>
              Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
            </CtaButton>
            <button
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex h-12 items-center gap-1.5 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Ver como funciona <ArrowDown className="h-4 w-4" />
            </button>
          </motion.div>

          <motion.p {...rise(0.32)} className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 lg:justify-start">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" /> Você só paga se quiser continuar depois dos 7 dias. Cancele quando quiser.
          </motion.p>
        </div>

        <motion.div {...rise(0.2)} className="relative">
          <ChatDemo />
        </motion.div>
      </div>
    </section>
  );
}
