import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BellRing, BrainCircuit, FileText, Mic, PiggyBank, Target } from 'lucide-react';

const FEATURES = [
  {
    icon: Target,
    title: 'Seus objetivos, no piloto automático',
    text: 'Diga “quero juntar R$ 20 mil para viajar até dezembro”. O Elio guarda o objetivo, calcula quanto separar por mês e te lembra do caminho.',
  },
  {
    icon: PiggyBank,
    title: 'Planejamento a partir da sua renda',
    text: 'Logo no primeiro acesso ele monta o seu plano: quanto vai para o essencial, quanto para o lazer e quanto para o futuro.',
  },
  {
    icon: FileText,
    title: 'Extratos e faturas sem digitar nada',
    text: 'Envie PDF, foto ou planilha de qualquer banco. Em segundos tudo está lido, organizado em categorias e guardado.',
  },
  {
    icon: Mic,
    title: 'Fale em vez de digitar',
    text: 'Dite “gastei 45 no mercado” ou faça uma pergunta pelo microfone. O Elio também lê as respostas em voz alta.',
  },
  {
    icon: BellRing,
    title: 'Contas em dia, sem susto',
    text: 'Ele lembra o que vence, dá baixa quando você diz “paguei” e descobre assinaturas e contas que se repetem todo mês.',
  },
  {
    icon: BrainCircuit,
    title: 'Um assistente que te conhece',
    text: 'Ele lembra do que você contou e usa isso nos conselhos. Você vê, edita e apaga tudo que ele sabe, quando quiser.',
  },
];

export default function AIFeatures() {
  const reduceMotion = useReducedMotion();
  return (
    <section id="recursos" data-section="ai-features" className="bg-slate-50/70 dark:bg-slate-900/60 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Conheça o Elio</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Um especialista em finanças no seu bolso</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Você só conversa. Ele cuida de planejar, organizar, lembrar e explicar, com a sua realidade e no seu ritmo.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-6 shadow-sm transition-shadow hover:shadow-lg hover:shadow-violet-500/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
