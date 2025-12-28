import React from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Tags, 
  PieChart, 
  Target, 
  Building2, 
  Globe, 
  Shield,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageToggle';

const additionalFeatures = [
  {
    icon: Globe,
    titleKey: 'features.international.title',
    descKey: 'features.international.desc'
  },
  {
    icon: Shield,
    titleKey: 'features.privacy.title',
    descKey: 'features.privacy.desc'
  },
  {
    icon: Zap,
    titleKey: 'features.fast.title',
    descKey: 'features.fast.desc'
  }
];

export default function FeaturesSection() {
  const { t } = useLanguage();
  
  const features = [
    {
      id: 'transactions',
      icon: CreditCard,
      title: t('features.transactions.title'),
      description: t('features.transactions.desc'),
      highlights: [t('features.transactions.h1'), t('features.transactions.h2'), t('features.transactions.h3')],
      color: 'emerald'
    },
    {
      id: 'categorize',
      icon: Tags,
      title: t('features.categorize.title'),
      description: t('features.categorize.desc'),
      highlights: [t('features.categorize.h1'), t('features.categorize.h2'), t('features.categorize.h3')],
      color: 'teal'
    },
    {
      id: 'visualize',
      icon: PieChart,
      title: t('features.visualize.title'),
      description: t('features.visualize.desc'),
      highlights: [t('features.visualize.h1'), t('features.visualize.h2'), t('features.visualize.h3')],
      color: 'cyan'
    },
    {
      id: 'plan',
      icon: Target,
      title: t('features.plan.title'),
      description: t('features.plan.desc'),
      highlights: [t('features.plan.h1'), t('features.plan.h2'), t('features.plan.h3')],
      color: 'sky'
    },
    {
      id: 'investments',
      icon: Building2,
      title: t('features.investments.title'),
      description: t('features.investments.desc'),
      highlights: [t('features.investments.h1'), t('features.investments.h2'), t('features.investments.h3')],
      color: 'indigo'
    }
  ];
  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            {t('features.label')}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            {t('features.title')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Main features - Grid layout without screenshots */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 mb-6`}>
                <feature.icon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                {feature.description}
              </p>
              <ul className="space-y-2">
                {feature.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Additional features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-32 grid md:grid-cols-3 gap-6"
        >
          {additionalFeatures.map((feature, index) => (
            <div
              key={feature.titleKey}
              className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
            >
              <feature.icon className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
              <p className="text-slate-600 dark:text-slate-400">{t(feature.descKey)}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}