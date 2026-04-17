import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Monitor, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const screenshots = [
  { src: '/dashboard-overview.png', alt: 'Dashboard' },
  { src: '/dashboard-categories.png', alt: 'Categorias' },
];

export default function HeroSection({ onBuy }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-200/30 dark:bg-slate-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Sem mensalidade · Pague uma vez, use para sempre
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Controle financeiro completo.
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Pague uma vez.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Sem mensalidade. Seus dados ficam 100% no seu Google. Acesso vitalício, suporte incluído.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              size="lg"
              onClick={onBuy}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Começar agora — 12x de R$39,99
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sem assinatura · Sem mensalidade · Acesso vitalício
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="text-sm">Desktop</span>
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <span className="text-sm">Mobile</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-md mx-auto h-6 rounded-md bg-slate-700 flex items-center px-3">
                    <span className="text-xs text-slate-400">moneywise.web.app</span>
                  </div>
                </div>
              </div>

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

                <button
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % screenshots.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Próximo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {screenshots.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-2 rounded-full transition-all ${index === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/70'}`}
                      aria-label={`Slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
