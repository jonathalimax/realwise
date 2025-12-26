import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageToggle';

export default function FooterSection() {
  const { t } = useLanguage();
  return (
    <footer className="relative overflow-hidden">
      {/* Final CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              {t('footer.title')}
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {t('footer.title2')}
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto">
              {t('footer.desc')}
            </p>
            <Button 
              size="lg" 
              className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              {t('footer.cta')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer links */}
      <div className="border-t border-slate-200 dark:border-slate-800 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="font-semibold text-lg">Limas Finance</span>
            </div>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center gap-8">
              <Link 
                to={createPageUrl('Support')} 
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Suporte
              </Link>
              <Link 
                to={createPageUrl('FeatureRequests')} 
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                {t('footer.feedback')}
              </Link>
              <Link 
                to={createPageUrl('Donations')} 
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                {t('footer.donations')}
              </Link>
            </nav>

            {/* Copyright */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{t('footer.made')}</span>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>© 2024</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}