import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Gauge, Mail, Share2, Sparkles, Target, Wallet } from 'lucide-react';
import CtaButton from './CtaButton';
import PhoneFrame from './PhoneFrame';
import { landingAnalytics } from '../../landingAnalytics';

const TONES = {
  proud: {
    label: 'Mês de orgulho',
    caption: 'Quando o mês vai bem, você vê o que fez certo e o que fazer com a sobra.',
    phones: [
      { src: '/landing/summary-proud-top.jpg', alt: 'Resumo do mês com nota 81 de 100: “Que mês, Ana.”' },
      { src: '/landing/summary-proud-flow.jpg', alt: 'Gráfico de para onde foi a renda e as categorias que mais cresceram ou caíram' },
      { src: '/landing/summary-proud-budget.jpg', alt: 'Gastos dos últimos seis meses, orçamento e sequência de meses no azul' },
    ],
  },
  improve: {
    label: 'Mês para ajustar',
    caption: 'Quando aperta, sem bronca: o resumo mostra por onde começar e quanto cada ajuste libera.',
    phones: [
      { src: '/landing/summary-improve-top.jpg', alt: 'Resumo do mês com nota 41 de 100: “Outubro pede atenção, Carlos.”' },
      { src: '/landing/summary-improve-fixes.jpg', alt: 'Lista “Por onde começar”: contas atrasadas e o gasto que mais subiu, com quanto cada ajuste libera' },
    ],
  },
};

const POINTS = [
  { icon: Gauge, title: 'Uma nota de 0 a 100', text: 'Poupança, orçamento, contas pagas e tendência viram um número fácil de acompanhar mês a mês.' },
  { icon: Wallet, title: 'Para onde foi cada real', text: 'A renda dividida em categorias, com o que subiu e o que caiu em relação ao mês passado.' },
  { icon: Target, title: 'O que ajustar, com valores', text: 'Não é só gráfico: cada ponto de atenção vem com quanto você libera por mês se resolver.' },
  { icon: Share2, title: 'Compartilhe sem mostrar valores', text: 'Um cartão só com porcentagens para comemorar a sua meta, sem expor o seu saldo.' },
];

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
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> Novo: resumo do mês
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Todo mês, um resumo que você <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">entende em 10 segundos</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            Sua nota de saúde financeira, para onde cada real foi e o que ajustar. Chega por e-mail no começo do mês e abre num link só seu, ou é só pedir ao Elio.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div role="tablist" aria-label="Exemplos de resumo" className="inline-flex rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
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
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500 dark:text-slate-400">{active.caption}</p>

        {/* Phones: side by side on a wide screen, a swipeable row on a phone. The middle one sits higher to give depth. */}
        <div
          key={tone}
          className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-2 pb-6 sm:justify-center lg:overflow-visible lg:pb-0"
          aria-live="polite"
        >
          {active.phones.map((p, i) => (
            <motion.div
              key={p.src}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={`w-[220px] shrink-0 snap-center sm:w-[250px] ${active.phones.length === 3 && i === 1 ? 'lg:-translate-y-8' : ''}`}
            >
              <PhoneFrame src={p.src} alt={p.alt} />
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Exemplos com dados fictícios.</p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"><p.icon className="h-5 w-5" /></span>
              <h3 className="mt-3 text-base font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"><Mail className="h-5 w-5" /></span>
            <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Chega na sua caixa de entrada, sem você pedir</h3>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              No começo de cada mês você recebe o resumo do mês que fechou, com os gráficos já no e-mail. Um toque abre a versão completa. Você também recebe um resumo dos seus primeiros dias, para ver o que o Elio já descobriu.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              {['O link é só seu e expira em 30 dias', 'Pare de receber quando quiser, com um clique', 'Peça a qualquer momento: “Elio, me mostra meu resumo”'].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{t}</li>
              ))}
            </ul>
            <CtaButton onClick={start} className="mt-7">
              Quero meu resumo <ArrowRight className="ml-2 h-4 w-4" />
            </CtaButton>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 truncate text-xs font-medium text-slate-500 dark:text-slate-400">Realwise · Seu outubro em resumo: que mês!</span>
              </div>
              <div className="relative max-h-[430px] overflow-hidden bg-slate-100">
                <img src="/landing/summary-email.jpg" alt="O e-mail do resumo mensal, com a nota, os números do mês, o gráfico de para onde foi a renda e os últimos meses" width="800" height="1250" loading="lazy" decoding="async" className="block h-auto w-full" />
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent dark:from-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
