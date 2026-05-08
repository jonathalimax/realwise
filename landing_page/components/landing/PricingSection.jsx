import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Shield, Lock, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const included = [
  'Dashboard e visão geral das finanças',
  'Gestão de transações com categorias personalizadas',
  'Contas a pagar com status e vencimentos',
  'Controle de cartões de crédito',
  'Importação de extrato (Nubank, Itaú, Bradesco)',
  'Planejador de renda e alocação de orçamento',
  'Carteira de investimentos',
  'Onboarding guiado passo a passo',
  'Modo escuro + acesso mobile e desktop',
  'Suporte vitalício por e-mail',
  'Correções e segurança — sempre gratuitas',
];

export default function PricingSection({ onBuy }) {
  return (
    <section id="preco" className="py-32 px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Preço
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Acesso vitalício
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Pague uma vez. Use para sempre. Sem mensalidade, sem surpresas.
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

            <div className="p-10 sm:p-14">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">
                <div className="space-y-4 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Pagamento único
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold">Acesso completo, para sempre</h3>
                  <ul className="space-y-2.5">
                    {included.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-300 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-center lg:text-right space-y-5 lg:min-w-[220px]">
                  <div>
                    <div className="text-4xl font-bold">12x de R$39,99</div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      ou R$479,88 à vista
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={onBuy}
                    className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Comprar agora
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Suporte vitalício por e-mail incluído
                  </p>
                  <div className="flex items-center justify-center lg:justify-end gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Stripe</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Seus dados só seus</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8 max-w-lg mx-auto"
        >
          Atualizações de segurança e correções sempre gratuitas. Novas funcionalidades são upgrades opcionais — você decide se quer e paga só pelo que usar.
        </motion.p>
      </div>
    </section>
  );
}
