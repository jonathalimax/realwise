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

function MobilePanel({ title, items, variant }) {
  const isRealwise = variant === 'realwise';
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isRealwise
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div
        className={`px-5 py-4 border-b ${
          isRealwise
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-100/60 dark:bg-emerald-950/40'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'
        }`}
      >
        <span
          className={`text-sm font-bold ${
            isRealwise
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {title}
        </span>
      </div>
      <ul className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
        {items.map((item) => (
          <li key={item.label} className="px-5 py-3 flex items-start gap-3">
            {isRealwise ? (
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <X className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">
                {item.label}
              </div>
              <div
                className={`text-sm font-medium ${
                  isRealwise
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.value}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WhyRealwiseSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Realwise vs. apps de assinatura.
          </h2>
        </motion.div>

        {/* Desktop: comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hidden md:block rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
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

        {/* Mobile: two stacked panels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="md:hidden space-y-4"
        >
          <MobilePanel
            title="Realwise"
            variant="realwise"
            items={rows.map((r) => ({ label: r.label, value: r.realwise }))}
          />
          <MobilePanel
            title="Apps de assinatura"
            variant="others"
            items={rows.map((r) => ({ label: r.label, value: r.others }))}
          />
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
