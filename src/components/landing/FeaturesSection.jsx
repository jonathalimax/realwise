import React from 'react';
import { motion } from 'framer-motion';
import {
  Smartphone,
  Upload,
  Tags,
  BarChart3,
  Target,
  Wallet,
  Moon,
  Globe,
  Shield,
  Bell,
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageToggle';

export default function FeaturesSection() {
  const { t, language } = useLanguage();

  const features = [
    { icon: Smartphone, label: language === 'pt' ? 'Desktop e Mobile' : 'Desktop & Mobile' },
    { icon: Upload, label: language === 'pt' ? 'Importar Extratos' : 'Import Statements' },
    { icon: Tags, label: language === 'pt' ? 'Auto-categorização' : 'Auto-categorization' },
    { icon: BarChart3, label: language === 'pt' ? 'Gráficos Claros' : 'Clear Charts' },
    { icon: Target, label: language === 'pt' ? 'Metas de Economia' : 'Savings Goals' },
    { icon: Wallet, label: language === 'pt' ? 'Múltiplas Contas' : 'Multiple Accounts' },
    { icon: CreditCard, label: language === 'pt' ? 'Cartões de Crédito' : 'Credit Cards' },
    { icon: TrendingUp, label: language === 'pt' ? 'Investimentos' : 'Investments' },
    { icon: Bell, label: language === 'pt' ? 'Lembretes de Contas' : 'Bill Reminders' },
    { icon: Moon, label: language === 'pt' ? 'Modo Escuro' : 'Dark Mode' },
    { icon: Globe, label: language === 'pt' ? 'Bilíngue (PT/EN)' : 'Bilingual (EN/PT)' },
    { icon: Shield, label: language === 'pt' ? 'Privacidade Total' : 'Full Privacy' },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            {t('features.label')}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            {t('features.title')}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
            {t('features.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <feature.icon className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">{feature.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
