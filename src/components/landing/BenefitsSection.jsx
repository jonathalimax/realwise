import React from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  Upload, 
  Tags, 
  BarChart3, 
  Target, 
  Moon 
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageToggle';

export default function BenefitsSection() {
  const { t } = useLanguage();
  
  const benefits = [
    {
      icon: Monitor,
      title: t('benefits.works'),
      description: t('benefits.works.desc')
    },
    {
      icon: Upload,
      title: t('benefits.import'),
      description: t('benefits.import.desc')
    },
    {
      icon: Tags,
      title: t('benefits.categorize'),
      description: t('benefits.categorize.desc')
    },
    {
      icon: BarChart3,
      title: t('benefits.charts'),
      description: t('benefits.charts.desc')
    },
    {
      icon: Target,
      title: t('benefits.plan'),
      description: t('benefits.plan.desc')
    },
    {
      icon: Moon,
      title: t('benefits.darkmode'),
      description: t('benefits.darkmode.desc')
    }
  ];
  return (
    <section className="py-12 sm:py-24 px-4 sm:px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            {t('benefits.title')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t('benefits.subtitle')}
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group text-center p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-2 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                <benefit.icon className="w-5 sm:w-6 h-5 sm:h-6" />
              </div>
              <h3 className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">{benefit.title}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-slate-500 dark:text-slate-400 italic">
            "{t('benefits.social')}"
          </p>
        </motion.div>
      </div>
    </section>
  );
}