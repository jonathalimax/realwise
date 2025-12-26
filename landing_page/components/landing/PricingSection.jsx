import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageToggle';

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
    <section className="py-32 px-6 bg-slate-50/50 dark:bg-slate-900/50">
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
            
            <div className="p-10 sm:p-14">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {t('pricing.badge')}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold">{t('pricing.complete')}</h3>
                  <ul className="space-y-3">
                    {[
                      t('pricing.feature1'),
                      t('pricing.feature2'),
                      t('pricing.feature3'),
                      t('pricing.feature4'),
                      t('pricing.feature5')
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="text-center lg:text-right space-y-4">
                  <div>
                    <div className="text-5xl font-bold">R$ {priceBRL}</div>
                    {language === 'en' && (
                      <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('pricing.converted')} ${priceUSD} USD
                      </div>
                    )}
                    <span className="text-slate-500 dark:text-slate-400 text-sm">{t('pricing.onetime')}</span>
                  </div>
                  <Button 
                    size="lg" 
                    className="w-full lg:w-auto h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    {t('pricing.cta')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('pricing.guarantee')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Why we donate section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 text-center max-w-2xl mx-auto space-y-6"
        >
          <h3 className="text-xl font-semibold mb-4">{t('pricing.why.title')}</h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('pricing.why.desc')}
          </p>
          
          {language === 'pt' && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-50 dark:bg-slate-900 px-4 text-sm text-slate-500 dark:text-slate-400">
                  ✝
                </span>
              </div>
            </div>
          )}
          
          {language === 'pt' && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900">
              <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed mb-3">
                "{t('pricing.why.verse')}"
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                — {t('pricing.why.verse.ref')}
              </p>
            </div>
          )}
          
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('pricing.note')}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}