import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Monitor, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageToggle';
import { Link } from 'react-router-dom';

const screenshots = [
  { src: '/dashboard-overview.png', alt: 'Dashboard Overview' },
  { src: '/dashboard-categories.png', alt: 'Spending by Category' },
];

export default function HeroSection() {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % screenshots.length);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      
      {/* Floating orbs - hidden on mobile to prevent overflow */}
      <div className="hidden sm:block absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="hidden sm:block absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-200/30 dark:bg-slate-500/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t('hero.badge')}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            {t('hero.headline1')}
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              {t('hero.headline2')}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-xl lg:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-light px-2">
            {t('hero.subheadline')}
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-10 sm:mb-16">
            <Link to="/checkout">
              <Button
                size="lg"
                className="h-12 sm:h-16 px-6 sm:px-10 text-base sm:text-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40"
              >
                {t('hero.cta')}
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('hero.note')}
            </p>
          </div>

          {/* Device mockup hint */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center gap-6 text-slate-400 dark:text-slate-500"
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="text-sm">{t('hero.desktop')}</span>
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <span className="text-sm">{t('hero.mobile')}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* App Preview - Real Screenshots Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Desktop mockup */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-700 bg-slate-900">
              {/* Browser header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-md mx-auto h-6 rounded-md bg-slate-700 flex items-center px-3">
                    <span className="text-xs text-slate-400">blimwallet.com</span>
                  </div>
                </div>
              </div>

              {/* Screenshot carousel */}
              <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentIndex}
                    src={screenshots[currentIndex].src}
                    alt={screenshots[currentIndex].alt}
                    className="w-full h-full object-cover object-top"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </AnimatePresence>

                {/* Navigation arrows */}
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {screenshots.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? 'bg-white w-6'
                          : 'bg-white/50 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl" />
            <div className="absolute -top-4 -left-4 w-40 h-40 bg-teal-400/20 rounded-full blur-3xl" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}