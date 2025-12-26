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

        {/* Main features */}
        <div className="space-y-32">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-col ${index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-12 lg:gap-20 items-center`}
            >
              {/* Content */}
              <div className="flex-1 space-y-6">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-${feature.color}-50 dark:bg-${feature.color}-950/50`}>
                  <feature.icon className={`w-7 h-7 text-${feature.color}-600 dark:text-${feature.color}-400`} />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold">{feature.title}</h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
                <ul className="space-y-3">
                  {feature.highlights.map((highlight, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="flex-1 w-full">
                <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl shadow-slate-900/5 dark:shadow-black/20">
                  {/* Decorative content based on feature */}
                  <div className="absolute inset-0 p-6">
                    {feature.id === 'transactions' && (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-600" />
                              <div className="h-2 w-16 rounded bg-slate-100 dark:bg-slate-700" />
                            </div>
                            <div className={`h-4 w-16 rounded ${i % 2 === 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-rose-100 dark:bg-rose-900/50'}`} />
                          </div>
                        ))}
                      </div>
                    )}
                    {feature.id === 'categorize' && (
                      <div className="grid grid-cols-3 gap-3 h-full">
                        {['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'].map((cat, i) => (
                          <div key={cat} className="rounded-xl bg-white dark:bg-slate-800 shadow-sm p-3 flex flex-col items-center justify-center">
                            <div className={`w-8 h-8 rounded-lg mb-2 ${['bg-amber-100', 'bg-blue-100', 'bg-pink-100', 'bg-purple-100', 'bg-red-100', 'bg-slate-100'][i]}`} />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{cat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {feature.id === 'visualize' && (
                      <div className="h-full flex flex-col">
                        <div className="flex-1 flex items-end gap-2 pb-4">
                          {[60, 80, 45, 90, 70, 55, 85, 75].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                              <div className="w-full rounded-t bg-emerald-400 dark:bg-emerald-500" style={{ height: `${h}%` }} />
                              <div className="w-full h-2 rounded bg-rose-200 dark:bg-rose-800" style={{ height: `${100-h-20}%` }} />
                            </div>
                          ))}
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-700" />
                      </div>
                    )}
                    {feature.id === 'plan' && (
                      <div className="space-y-4">
                        {[{ label: 'Emergency Fund', progress: 75 }, { label: 'Vacation', progress: 45 }, { label: 'New Car', progress: 20 }].map((goal, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{goal.label}</span>
                              <span className="text-sm text-emerald-600 dark:text-emerald-400">{goal.progress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${goal.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {feature.id === 'investments' && (
                      <div className="grid grid-cols-2 gap-3 h-full">
                        {[{ name: 'Checking', val: '$5,420' }, { name: 'Savings', val: '$12,800' }, { name: 'Stocks', val: '$8,350' }, { name: 'Crypto', val: '$2,100' }].map((acc, i) => (
                          <div key={i} className="rounded-xl bg-white dark:bg-slate-800 shadow-sm p-4 flex flex-col justify-between">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{acc.name}</p>
                              <p className="text-lg font-semibold">{acc.val}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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