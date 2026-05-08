import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  CreditCard,
  Upload,
  PiggyBank,
  PieChart,
  BarChart3,
  Moon,
  Smartphone,
  Sparkles,
  Shield,
} from 'lucide-react';

const features = [
  { icon: LayoutDashboard, title: 'Dashboard', desc: 'Visão geral das suas finanças em tempo real' },
  { icon: ArrowLeftRight, title: 'Transações', desc: 'Registre receitas e despesas com categorias personalizadas' },
  { icon: FileText, title: 'Contas a pagar', desc: 'Nunca esqueça uma conta — acompanhe status e vencimentos' },
  { icon: CreditCard, title: 'Cartões de crédito', desc: 'Controle faturas e datas de pagamento por cartão' },
  { icon: Upload, title: 'Importação de extrato', desc: 'Importe CSV do Nubank, Itaú e Bradesco com categorização inteligente' },
  { icon: PiggyBank, title: 'Planejador de renda', desc: 'Configure seu salário e deduções para saber seu líquido real' },
  { icon: PieChart, title: 'Alocação de orçamento', desc: 'Distribua sua renda em categorias com metas percentuais' },
  { icon: BarChart3, title: 'Carteira de investimentos', desc: 'Acompanhe sua carteira e diversificação por classe de ativo' },
  { icon: Sparkles, title: 'Onboarding guiado', desc: 'Configuração assistida passo a passo ao criar sua conta' },
  { icon: Moon, title: 'Modo escuro', desc: 'Interface clara ou escura, como preferir' },
  { icon: Smartphone, title: 'PWA', desc: 'Instale no celular ou use no navegador — acesse de qualquer dispositivo' },
  { icon: Shield, title: 'Privacidade total', desc: 'Seus dados ficam só no seu Google. Ninguém mais tem acesso.' },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Funcionalidades
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Tudo que você precisa
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Pensado para brasileiros que querem controle real, sem complicação.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <feature.icon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{feature.title}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
