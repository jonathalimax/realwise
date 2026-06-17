import React from 'react';

import { ShieldCheck } from 'lucide-react';

export default function GuaranteeSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl mx-auto mt-8 px-6"
    >
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/30 p-6 flex items-start gap-4">
        <ShieldCheck className="w-8 h-8 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">30 dias de garantia incondicional.</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Usou e não foi pra você? Devolvo seu dinheiro. Sem perguntar o porquê, sem letra miúda. É só me chamar.
            O risco é meu, não seu. <a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="underline font-medium">suporte@realwise.com.br</a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
