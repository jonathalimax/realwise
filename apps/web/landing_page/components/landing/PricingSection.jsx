import React from 'react';
import { motion } from 'framer-motion';

import { Check, ArrowRight, Lock, Shield, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

const included = [
  'Importação de extratos e entrada manual',
  'Planejamento do mês e contas a pagar',
  'Investimentos e visão de patrimônio',
  'Assistente de finanças no chat',
  'Suporte sempre que precisar',
  'Melhorias e correções incluídas',
];

const plans = [
  {
    name: 'Mensal',
    description: 'Flexibilidade total, mês a mês.',
    highlight: false,
  },
  {
    name: 'Anual',
    description: 'Um pagamento por ano com desconto em relação ao mensal.',
    highlight: true,
    badge: 'Melhor custo-benefício',
  },
];

const trust = [
  { icon: Lock, text: 'Pagamento seguro (Stripe)' },
  { icon: Shield, text: 'Dados 100% seus' },
  { icon: Smartphone, text: 'Desktop + Mobile' },
];

export default function PricingSection({ onBuy }) {
  const startTrial = () => {
    landingAnalytics.trackCtaClicked('Teste grátis por 3 dias', 'pricing');
    if (onBuy) {
      onBuy();
      return;
    }
    sessionStorage.setItem('__rw_show_login', '1');
    window.location.href = '/login';
  };

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
            Teste grátis por 3 dias.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Use o Realwise completo, sem cartão. Gostou? Escolha o plano mensal ou anual.
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

            <div className="p-6 sm:p-12 space-y-8">
              <div className="grid sm:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`rounded-2xl border-2 p-5 ${
                      plan.highlight
                        ? 'border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-bold">{plan.name}</span>
                      {plan.badge && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/50 text-xs font-medium text-violet-700 dark:text-violet-300">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{plan.description}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Você vê os valores atualizados dos planos dentro do app.
                Cupons de desconto podem ser aplicados na tela de pagamento.
              </p>

              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  E quando o teste terminar?
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  O acesso é pausado até você assinar. Seus dados ficam guardados e voltam assim que a assinatura é confirmada.
                </p>
              </div>

              <Button
                size="lg"
                onClick={startTrial}
                className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
              >
                Teste grátis por 3 dias
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
          Sem fidelidade: cancele quando quiser, direto no app.
        </motion.p>
      </div>
    </section>
  );
}
