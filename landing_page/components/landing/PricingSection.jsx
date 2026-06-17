import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { Check, ArrowRight, Lock, Shield, Smartphone, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const included = [
  'Dashboard e transações',
  'Contas a pagar e cartões',
  'Importação de extrato',
  'Planejador e orçamento',
  'Carteira de investimentos',
  'Dados no seu Firebase',
  'Suporte vitalício',
  'Segurança sempre grátis',
];

const trust = [
  { icon: Lock, text: '100% seguro (Mercado Pago)' },
  { icon: Shield, text: 'Dados 100% seus' },
  { icon: Smartphone, text: 'Desktop + Mobile' },
  { icon: Database, text: 'Seu Firebase' },
];

const FALLBACK_PRICING = { originalCents: 47988, totalCents: 23880, installments: 12, active: true, campaignLabel: null };

function fmt(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default function PricingSection({ onBuy, couponCode = '' }) {
  const [pricing, setPricing] = useState(FALLBACK_PRICING);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data && data.active) setPricing(data);
    });
    return () => unsub();
  }, []);

  const installmentCents = Math.round(pricing.totalCents / pricing.installments);
  const discountPercent = Math.round((1 - pricing.totalCents / pricing.originalCents) * 100);

  return (
    <section data-section="pricing" id="preco" className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Seu, pra sempre.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Compre uma vez. Use para sempre. Nunca pague novamente.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <div className="relative rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-400 via-violet-400 to-cyan-400" />

            <div className="p-10 sm:p-12 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-2 self-start">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200/50 dark:border-violet-800/50">
                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                      Pagamento único
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200/50 dark:border-rose-800/50">
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {discountPercent}% OFF{pricing.campaignLabel ? ` — ${pricing.campaignLabel}` : ' — Oferta por tempo limitado'}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-slate-400 dark:text-slate-500 line-through">{fmt(pricing.originalCents)}</div>
                  <div className="text-4xl font-bold">{pricing.installments}x de {fmt(installmentCents)}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    ou {fmt(pricing.totalCents)} à vista · sem juros
                  </div>
                </div>
              </div>

              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                <div className="grid grid-cols-[1fr_auto] gap-4 text-slate-500 dark:text-slate-400">
                  <span>Assinatura em 30 anos</span>
                  <span className="line-through text-right">R$ 3.600–14.400</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 font-semibold text-violet-600 dark:text-violet-400">
                  <span>Realwise (sempre)</span>
                  <div className="text-right">
                    <span className="line-through text-slate-400 dark:text-slate-500 font-normal mr-2">{fmt(pricing.originalCents)}</span>
                    <span>{fmt(pricing.totalCents)}</span>
                  </div>
                </div>
              </div>

              {couponCode && (
                <div className="flex justify-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-sm font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    Cupom <span className="font-mono font-bold text-violet-300 ml-0.5">{couponCode}</span> ativo
                  </div>
                </div>
              )}
              <Button
                size="lg"
                onClick={() => { landingAnalytics.trackCtaClicked('Quero o meu acesso', 'pricing'); onBuy(); }}
                className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
              >
                Quero o meu acesso
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <div className="flex flex-wrap gap-4 justify-center">
                {trust.map((item) => (
                  <span
                    key={item.text}
                    className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500"
                  >
                    <item.icon className="w-3 h-3" />
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8"
        >
          Correções de bugs, melhorias e suporte estão incluídos para sempre. Novas funcionalidades são upgrades opcionais — você decide se quer e paga só pelo que usar.
        </motion.p>
      </div>
    </section>
  );
}
