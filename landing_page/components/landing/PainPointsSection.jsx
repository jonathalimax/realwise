import React from 'react';
import { motion } from 'framer-motion';

const pains = [
  '"Ainda uso planilha do Excel porque nenhum app me convenceu a abandoná-la."',
  '"Pago mensalidade há anos em apps de finanças. Já gastei mais do que economizei com eles."',
  '"O app sabe tudo sobre o meu dinheiro — e eu nem sei o que eles fazem com isso."',
  '"Já abandonei vários apps. Cada um que fecho, meus dados ficam lá, perdidos."',
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
          <h2 className="text-3xl sm:text-4xl font-bold">
            Soa familiar?
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {pains.map((pain, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                {pain}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
