import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BellRing, Inbox, Mail, MousePointerClick } from 'lucide-react';
import CtaButton from './CtaButton';
import { landingAnalytics } from '../../landingAnalytics';

const TONES = {
  proud: {
    label: 'Mês de orgulho',
    caption: 'Quando o mês vai bem, você vê o que fez certo e o que fazer com a sobra.',
    subject: 'Seu outubro em resumo: que mês!',
    src: '/landing/summary-email-proud.jpg',
    alt: 'E-mail do resumo mensal: nota 87 de 100, quanto entrou, saiu e foi guardado, para onde foi a renda, os últimos meses e o próximo passo',
    height: 1545,
  },
  improve: {
    label: 'Mês para ajustar',
    caption: 'Quando aperta, sem bronca: o e-mail mostra por onde começar e quanto falta para fechar no azul.',
    subject: 'Seu outubro em resumo: vamos ajustar juntos',
    src: '/landing/summary-email-improve.jpg',
    alt: 'E-mail do resumo mensal: nota 37 de 100, a conta atrasada, para onde foi a renda e o que ajustar para fechar no azul',
    height: 1647,
  },
};

export default function SummaryShowcase() {
  const reduceMotion = useReducedMotion();
  const [tone, setTone] = useState('proud');
  const active = TONES[tone];

  const start = () => {
    landingAnalytics.trackCtaClicked('Começar grátis', 'summary');
    sessionStorage.setItem('__rw_show_login', '1');
    window.location.href = '/login';
  };

  return (
    <section id="resumo" data-section="summary" className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/60 to-white px-6 py-20 dark:from-slate-900 dark:via-violet-950/20 dark:to-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr]">
          {/* Copy: the point is that it lands in the inbox without the person doing anything. */}
          <div className="lg:sticky lg:top-24">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <Inbox className="h-3.5 w-3.5" /> Direto no seu e-mail
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Todo mês, o seu resumo <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">chega por e-mail</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              No começo do mês, sem você pedir nem abrir o app: a nota de saúde financeira, para onde foi cada real e o que ajustar, com os gráficos já dentro do e-mail. Você entende em 10 segundos.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {[
                { icon: BellRing, text: 'Chega sozinho, todo começo de mês, no e-mail que você cadastrou' },
                { icon: Mail, text: 'Os números e gráficos já vêm no corpo do e-mail, sem precisar de login' },
                { icon: MousePointerClick, text: 'Quer ver mais? Um toque abre a versão completa, numa página privada só sua' },
              ].map((i) => (
                <li key={i.text} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"><i.icon className="h-4 w-4" /></span>
                  <span className="pt-0.5">{i.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">O link é só seu e expira em 30 dias. Pare de receber quando quiser, com um clique. Ou peça a qualquer momento: “Elio, me mostra meu resumo”.</p>

            <CtaButton onClick={start} className="mt-7">
              Quero receber o meu resumo <ArrowRight className="ml-2 h-4 w-4" />
            </CtaButton>
          </div>

          {/* The real e-mail, in an inbox window. Scrolls inside the window, like opening it. */}
          <div>
            <div className="flex justify-center lg:justify-start">
              <div role="tablist" aria-label="Exemplos de e-mail" className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                {Object.entries(TONES).map(([key, t]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tone === key}
                    onClick={() => setTone(key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tone === key ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400 lg:text-left">{active.caption}</p>

            <motion.div
              key={tone}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Realwise <span className="font-normal text-slate-400">· contato@realwise.com.br</span></p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{active.subject}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">1º do mês, 9h30</span>
              </div>
              <div className="relative max-h-[560px] overflow-y-auto bg-slate-100 dark:bg-slate-900" tabIndex={0} aria-label="Role para ver o e-mail inteiro">
                <img src={active.src} alt={active.alt} width="800" height={active.height} loading="lazy" decoding="async" className="block h-auto w-full" />
              </div>
              <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/60">Role para ver o e-mail inteiro · exemplo com dados fictícios</p>
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
}
