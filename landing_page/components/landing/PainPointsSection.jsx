import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, AlertCircle, LayoutGrid, CreditCard } from 'lucide-react';

const pains = [
  {
    icon: HelpCircle,
    pain: 'Não sei pra onde vai meu dinheiro todo mês',
    solution: 'Dashboard com visão clara de receitas, despesas e categorias — tudo em tempo real.',
  },
  {
    icon: AlertCircle,
    pain: 'Esqueço de pagar contas e pago juros à toa',
    solution: 'Gerencie todas as contas a pagar com status e vencimentos visíveis de um só lugar.',
  },
  {
    icon: LayoutGrid,
    pain: 'Tenho dados espalhados em vários apps e planilhas',
    solution: 'Importe seu extrato (Nubank, Itaú, Bradesco) e deixe o algoritmo categorizar automaticamente.',
  },
  {
    icon: CreditCard,
    pain: 'Pago mensalidade pra app que não uso direito',
    solution: 'Pague uma vez. Use para sempre. Seus dados no seu Google. Sem surpresas.',
  },
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
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Você se identifica?
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Esses problemas soam familiares?
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {pains.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">"{item.pain}"</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    → {item.solution}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
