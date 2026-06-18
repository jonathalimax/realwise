import React from 'react';
import { motion } from 'framer-motion';

import {
  Upload,
  BarChart3,
  FileText,
  CreditCard,
  PiggyBank,
  PieChart,
  Shield,
  Database,
  BrainCircuit,
  EyeOff,
} from 'lucide-react';

const clusters = [
  {
    title: 'Privacidade',
    features: [
      { icon: Shield, title: 'Dados no seu Google', desc: 'Ficam na sua conta. Não nos nossos servidores.' },
      { icon: EyeOff, title: 'Sem Open Banking', desc: 'Importe CSV ou PDF. Sem ler sua conta direto.' },
      { icon: Database, title: 'Zero rastreamento', desc: 'Nunca vendemos ou usamos seus dados.' },
    ],
  },
  {
    title: 'Inteligência',
    features: [
      { icon: BrainCircuit, title: 'Categorização que aprende', desc: 'Corrija uma vez. O app repete sozinho.' },
      { icon: Upload, title: 'Importação simples', desc: 'Nubank, Itaú, Bradesco. Em minutos.' },
      { icon: BarChart3, title: 'Análise de gastos', desc: 'Padrões e comparações por mês.' },
    ],
  },
  {
    title: 'Controle',
    features: [
      { icon: FileText, title: 'Contas e alertas', desc: 'Sem juros por esquecimento.' },
      { icon: CreditCard, title: 'Cartões de crédito', desc: 'Saiba quando cada fatura vence.' },
      { icon: PiggyBank, title: 'Planejador de renda', desc: 'Bruto, deduções, líquido real.' },
      { icon: PieChart, title: 'Orçamento e metas', desc: 'Distribua a renda por categoria.' },
    ],
  },
];

export default function FeaturesSection() {
  return (
    <section data-section="features" id="funcionalidades" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Tudo em um só lugar.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Privacidade, inteligência e controle — sem complicar.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6">
          {clusters.map((cluster, ci) => (
            <motion.div
              key={cluster.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: ci * 0.1 }}
            >
              <div className="mb-5">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 tracking-widest uppercase">
                  {cluster.title}
                </span>
              </div>
              <div className="space-y-3">
                {cluster.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <feature.icon className="w-5 h-5 text-violet-500 flex-shrink-0" />
                      <span className="font-semibold text-base text-slate-900 dark:text-white">
                        {feature.title}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-8">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
