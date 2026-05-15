import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const rows = [
  { label: 'Pagamento', realwise: 'Uma vez (R$ 479,88)', others: 'Todo mês, para sempre' },
  { label: 'Custo em 30 anos', realwise: 'R$ 479,88', others: 'R$ 3.600 – 14.400' },
  { label: 'Renovação automática', realwise: 'Nunca', others: 'Todo mês' },
  { label: 'Seus dados ficam', realwise: 'No seu Google Firebase', others: 'Nos servidores deles' },
  { label: 'Se o preço subir', realwise: 'Não te afeta', others: 'Você paga mais ou sai' },
  { label: 'Suporte', realwise: 'Vitalício, incluído', others: 'Enquanto pagar' },
  { label: 'Liberdade para sair', realwise: 'Total', others: 'Você perde acesso' },
];

export default function WhyRealwiseSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">
            Realwise vs. apps de assinatura.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <div className="p-4" />
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Realwise</span>
              </div>
            </div>
            <div className="p-4 text-center">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Apps de assinatura</span>
            </div>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${index % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}
            >
              <div className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                {row.label}
              </div>
              <div className="p-4 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{row.realwise}</span>
              </div>
              <div className="p-4 flex items-center justify-center gap-1.5">
                <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400">{row.others}</span>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center text-slate-500 dark:text-slate-400 mt-8 font-medium"
        >
          Não é só mais barato. É um modelo diferente.
        </motion.p>
      </div>
    </section>
  );
}
