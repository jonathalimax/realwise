import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Lock, Shield, Smartphone, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

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

export default function PricingSection({ onBuy, couponCode = '' }) {
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
            Uma decisão. Para sempre.
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
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

            <div className="p-10 sm:p-12 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-2 self-start">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Pagamento único
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200/50 dark:border-rose-800/50">
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      50% OFF — Oferta por tempo limitado
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-slate-400 dark:text-slate-500 line-through">R$ 479</div>
                  <div className="text-4xl font-bold">em até 12x sem juros</div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    ou R$ 239 à vista
                  </div>
                </div>
              </div>

              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                <div className="grid grid-cols-[1fr_auto] gap-4 text-slate-500 dark:text-slate-400">
                  <span>Assinatura em 30 anos</span>
                  <span className="line-through text-right">R$ 3.600–14.400</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Realwise (sempre)</span>
                  <div className="text-right">
                    <span className="line-through text-slate-400 dark:text-slate-500 font-normal mr-2">R$ 479</span>
                    <span>R$ 239</span>
                  </div>
                </div>
              </div>

              {couponCode && (
                <div className="flex justify-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    Cupom <span className="font-mono font-bold text-emerald-300 ml-0.5">{couponCode}</span> ativo
                  </div>
                </div>
              )}
              <Button
                size="lg"
                onClick={() => { landingAnalytics.trackCtaClicked('Começar agora', 'pricing'); onBuy(); }}
                className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
              >
                Assumir o controle
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
