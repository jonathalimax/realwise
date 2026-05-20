import React from 'react';
import { motion } from 'framer-motion';

export default function SubscriptionTrapSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Uma compra. Para sempre.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Pague uma vez. Sem renovações, sem surpresas.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-2xl text-center border bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
          >
            <div className="text-3xl font-bold mb-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
              R$ 3.600–14.400
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Apps de assinatura em 30 anos
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-8 rounded-2xl text-center border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          >
            <div className="text-3xl font-bold mb-2 whitespace-nowrap text-emerald-600 dark:text-emerald-400">
              R$ 479
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Realwise. Para sempre.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
