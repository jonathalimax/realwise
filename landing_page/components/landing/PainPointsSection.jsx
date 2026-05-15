import React from 'react';
import { motion } from 'framer-motion';

const pains = [
  { title: 'Planilha sem fim', desc: 'Você tenta organizar, mas sempre volta pro Excel.' },
  { title: 'Mensalidade eterna', desc: 'Paga há anos e nem lembra mais por quê.' },
  { title: 'Dados nas mãos deles', desc: 'O app sabe tudo. Você não sabe quase nada.' },
  { title: 'Apps abandonados', desc: 'Cada um que fecha leva seus dados junto.' },
];

export default function PainPointsSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Cansado de tudo isso?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Você não está sozinho. E existe um jeito melhor.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pains.map((pain, index) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <h3 className="font-semibold text-base text-slate-900 dark:text-white mb-2">
                {pain.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {pain.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
