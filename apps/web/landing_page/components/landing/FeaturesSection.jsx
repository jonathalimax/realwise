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
    title: 'Organize',
    features: [
      { icon: Upload, title: 'Importação simples', desc: 'Traga extratos e organize seu histórico em minutos.' },
      { icon: BarChart3, title: 'Análise do que já aconteceu', desc: 'Veja gastos, entradas e categorias.' },
      { icon: FileText, title: 'Entrada manual', desc: 'Registre tudo o que quiser, mesmo sem importar arquivos.' },
    ],
  },
  {
    title: 'Planeje',
    features: [
      { icon: PiggyBank, title: 'Planejamento', desc: 'Descubra quanto ainda pode gastar com segurança.' },
      { icon: CreditCard, title: 'Contas e acompanhamento', desc: 'Acompanhe vencimentos, recorrências e organização do mês.' },
      { icon: PieChart, title: 'Investimentos e visão avançada', desc: 'Enxergue patrimônio, metas e decisões de longo prazo.' },
      { icon: BrainCircuit, title: 'Automação que economiza tempo', desc: 'Mais contexto, menos trabalho manual no dia a dia.' },
    ],
  },
  {
    title: 'Privacidade',
    features: [
      { icon: Shield, title: 'Sem Open Banking', desc: 'Você não entrega sua senha bancária nem conecta sua conta diretamente.' },
      { icon: EyeOff, title: 'Sem uso publicitário dos seus dados', desc: 'O foco é te ajudar a entender suas finanças, não te rastrear.' },
      { icon: Database, title: 'Dados protegidos na infraestrutura Realwise', desc: 'Sua conta é privada e separada das demais, sem promessa enganosa de infra dedicada.' },
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
            Do extrato ao planejamento do mês.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Veja o que aconteceu e decida o que fazer daqui para frente, tudo no mesmo app.
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
