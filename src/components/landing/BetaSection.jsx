import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Zap, Eye, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageToggle';

export default function BetaSection() {
  const { t } = useLanguage();
  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/50 dark:border-amber-800/50 mb-6">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t('beta.badge')}
              </span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              {t('beta.title')}
            </h2>
            
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              {t('beta.desc')}
            </p>

            <ul className="space-y-4 mb-10">
              {[
                { icon: MessageSquare, text: t('beta.feature1') },
                { icon: Zap, text: t('beta.feature2') },
                { icon: Eye, text: t('beta.feature3') }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">{item.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="h-14 px-10 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:scale-105"
              >
                {t('beta.cta')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-10 text-lg font-medium rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                asChild
              >
                <Link to={createPageUrl('FeatureRequest')}>
                  {t('beta.feedback')}
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Right visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 p-8 shadow-xl">
              {/* Feedback illustration */}
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('beta.feedbackTitle') || 'Your voice matters'}</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                  {t('beta.feedbackDesc') || 'Submit ideas, vote on features, and help us build the finance tracker you need.'}
                </p>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -z-10 top-8 right-8 w-40 h-40 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -z-10 bottom-8 left-8 w-32 h-32 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}