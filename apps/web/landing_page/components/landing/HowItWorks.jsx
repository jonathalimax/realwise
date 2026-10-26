import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, Paperclip, Sparkles } from 'lucide-react';

const STEPS = [
  {
    icon: Paperclip,
    title: 'Envie',
    text: 'Extratos, faturas, fotos ou planilhas de qualquer banco, vários de uma vez.',
  },
  {
    icon: Sparkles,
    title: 'O John organiza',
    text: 'Descobre a conta de cada um, categoriza, aprende com você e deixa as transferências entre suas contas fora dos totais.',
  },
  {
    icon: MessageCircle,
    title: 'Pergunte',
    text: '“Quanto gastei no mês passado?” “Onde posso economizar?” Respostas com os seus números, na hora.',
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();
  return (
    <section id="como-funciona" data-section="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Três passos, zero planilha</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Tudo acontece numa conversa.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-6 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">
                <span className="mr-2 text-violet-500">{i + 1}.</span>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
