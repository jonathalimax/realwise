import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '@/components/LanguageToggle';

export default function FooterSection() {
  const { t } = useLanguage();
  return (
    <footer className="relative overflow-hidden">
      {/* Final CTA Section */}
      <section className="py-16 sm:py-32 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              {t('footer.title')}
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {t('footer.title2')}
              </span>
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 mb-6 sm:mb-10 max-w-xl mx-auto">
              {t('footer.desc')}
            </p>
            <Link to="/login">
              <Button
                size="lg"
                className="h-12 sm:h-16 px-8 sm:px-12 text-base sm:text-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40"
              >
                {t('footer.cta')}
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer links */}
      <div className="border-t border-slate-200 dark:border-slate-800 py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
              <span className="font-bold text-lg">Realwise</span>
            </div>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              <Link
                to={createPageUrl('Support')}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                {t('footer.support')}
              </Link>
              <Link
                to={createPageUrl('FeatureRequest')}
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
              <span>
                {t('footer.made')}{' '}
                <a href="https://linkedin.com/in/jonathalimax" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">Jonatha Lima</a>
                {' '}· © 2026
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
