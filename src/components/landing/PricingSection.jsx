import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Heart, ArrowRight, Globe, Lock, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageToggle';
import { Link } from 'react-router-dom';

export default function PricingSection() {
  const { t, language } = useLanguage();
  const [usdRate, setUsdRate] = useState(5.80); // Default BRL to USD rate
  
  useEffect(() => {
    // Fetch current exchange rate
    fetch('https://api.exchangerate-api.com/v4/latest/BRL')
      .then(res => res.json())
      .then(data => {
        if (data.rates && data.rates.USD) {
          setUsdRate(1 / data.rates.USD);
        }
      })
      .catch(() => {
        // Use default if API fails
      });
  }, []);
  
  const priceBRL = 99;
  const priceUSD = (priceBRL / usdRate).toFixed(2);
  return (
    <section id="pricing" className="py-16 sm:py-32 px-4 sm:px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            {t('pricing.label')}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            {t('pricing.title')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          {/* Main pricing card */}
          <div className="relative rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            
            <div className="p-5 sm:p-10 lg:p-14">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {t('pricing.badge')}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold">{t('pricing.complete')}</h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {[
                      t('pricing.feature1'),
                      t('pricing.feature2'),
                      t('pricing.feature3'),
                      t('pricing.feature4'),
                      t('pricing.feature5'),
                      t('pricing.feature6')
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                        <Check className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="text-center lg:text-right space-y-3 sm:space-y-4">
                  <div>
                    <div className="text-3xl sm:text-5xl font-bold">R$ {priceBRL}</div>
                    {language === 'en' && (
                      <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('pricing.converted')} ${priceUSD} USD
                      </div>
                    )}
                    <span className="text-slate-500 dark:text-slate-400 text-sm">{t('pricing.onetime')}</span>
                  </div>
                  <Link to="/checkout">
                    <Button
                      size="lg"
                      className="w-full lg:w-auto h-12 sm:h-16 px-8 sm:px-12 text-base sm:text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40"
                    >
                      {t('pricing.cta')}
                      <ArrowRight className="ml-3 h-6 w-6" />
                    </Button>
                  </Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('pricing.guarantee')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Why Choose Us section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16"
        >
          <h3 className="text-xl font-semibold mb-6 text-center">{t('pricing.why.title')}</h3>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="text-center p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Globe className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">{t('pricing.why1.title')}</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{t('pricing.why1.desc')}</p>
            </div>
            <div className="text-center p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Lock className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">{t('pricing.why2.title')}</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{t('pricing.why2.desc')}</p>
            </div>
            <div className="text-center p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <Infinity className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">{t('pricing.why3.title')}</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{t('pricing.why3.desc')}</p>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-700 text-center max-w-2xl mx-auto">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('pricing.note')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}