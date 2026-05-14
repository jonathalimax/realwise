import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
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
      { icon: Shield, title: 'Seus dados, seu Firebase', desc: 'Ficam na sua conta Google — não nos nossos servidores. Você pode deletar tudo quando quiser.' },
      { icon: EyeOff, title: 'Sem Open Banking', desc: 'Importe CSV ou PDF do seu banco. Nenhum app lê sua conta diretamente.' },
      { icon: Database, title: 'Zero rastreamento financeiro', desc: 'Não usamos seus dados para treinar modelos, anunciar ou vender. Nunca.' },
    ],
  },
  {
    title: 'Inteligência',
    features: [
      { icon: BrainCircuit, title: 'Categorização que aprende', desc: 'Corrija uma vez. O app aprende seus padrões e repete automaticamente.' },
      { icon: Upload, title: 'Importação simples', desc: 'Nubank, Itaú, Bradesco. Suba o extrato e organize em minutos.' },
      { icon: BarChart3, title: 'Análise de gastos', desc: 'Padrões, categorias e comparações por mês — sem precisar montar uma planilha.' },
    ],
  },
  {
    title: 'Controle',
    features: [
      { icon: FileText, title: 'Contas e alertas', desc: 'Vencimentos, faturas, status. Sem juros por esquecimento.' },
      { icon: CreditCard, title: 'Cartões de crédito', desc: 'Organize por cartão. Saiba quando cada fatura vence.' },
      { icon: PiggyBank, title: 'Planejador de renda', desc: 'Bruto, deduções, líquido real.' },
      { icon: PieChart, title: 'Orçamento e alocação', desc: 'Distribua a renda por categoria com metas.' },
    ],
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">
            Tudo que você precisava. Nada que te assusta.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-8">
          {clusters.map((cluster, ci) => (
            <motion.div
              key={cluster.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: ci * 0.1 }}
            >
              <div className="mb-4">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
                  {cluster.title}
                </span>
              </div>
              <div className="space-y-3">
                {cluster.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <feature.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {feature.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
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
