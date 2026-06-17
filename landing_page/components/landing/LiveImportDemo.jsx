import React, { useState } from 'react';
import {AnimatePresence } from 'framer-motion';
import { Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MOCK_TRANSACTIONS = [
  { desc: 'IFOOD *IFOOD', amount: -47.9, category: 'Alimentação' },
  { desc: 'UBER *TRIP', amount: -23.5, category: 'Transporte' },
  { desc: 'NETFLIX.COM', amount: -39.9, category: 'Assinaturas' },
  { desc: 'POSTO SHELL', amount: -150.0, category: 'Transporte' },
  { desc: 'PIX RECEBIDO - SALARIO', amount: 4200.0, category: 'Renda' },
  { desc: 'FARMACIA DROGASIL', amount: -68.3, category: 'Saúde' },
];

function fmt(v) {
  const sign = v < 0 ? '-' : '+';
  return `${sign} R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;
}

export default function LiveImportDemo() {
  const [started, setStarted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const handleImport = () => {
    setStarted(true);
    setRevealedCount(0);
    MOCK_TRANSACTIONS.forEach((_, i) => {
      setTimeout(() => setRevealedCount(i + 1), 400 * (i + 1));
    });
  };

  return (
    <section data-section="live-demo" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Veja a mágica.</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            É assim que parece. Você traz o extrato, o Realwise faz o resto. Nenhum dado seu sai do seu controle — este exemplo é só uma simulação local.
          </p>
        </motion.div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
          {!started ? (
            <div className="p-10 flex flex-col items-center gap-4">
              <Upload className="w-10 h-10 text-violet-500" />
              <Button onClick={handleImport} className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6">
                Importar exemplo
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              <AnimatePresence>
                {MOCK_TRANSACTIONS.slice(0, revealedCount).map((tx) => (
                  <motion.li
                    key={tx.desc}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{tx.desc}</p>
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                        <Check className="w-3 h-3" /> {tx.category}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${tx.amount < 0 ? 'text-slate-600 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fmt(tx.amount)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
