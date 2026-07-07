import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import VideoSection from './VideoSection';

const ROTATING_BENEFITS = [
  'que se preenche sozinha',
  'que organiza seus gastos',
  'que você controla 100%',
];

export default function HeroSection({ onBuy, couponCode = '' }) {
  const [currentBenefit, setCurrentBenefit] = useState(0);

  const startFree = () => {
    landingAnalytics.trackCtaClicked('Começar grátis', 'hero');
    if (onBuy) {
      onBuy();
      return;
    }
    sessionStorage.setItem('__rw_show_login', '1');
    window.location.href = '/login';
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBenefit((prev) => (prev + 1) % ROTATING_BENEFITS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section data-section="hero" className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .glow-animate {
          animation: glow-pulse 8s ease-in-out infinite;
        }
        .glow-animate-fast {
          animation: glow-pulse 6s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-violet-900/20" />

      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-200/20 dark:bg-violet-500/15 rounded-full blur-3xl glow-animate"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-200/20 dark:bg-indigo-500/12 rounded-full blur-3xl glow-animate-fast"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, delay: 1 }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {couponCode && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                Cupom <span className="font-mono font-bold text-violet-300 ml-0.5">{couponCode}</span> ativo
              </div>
            </div>
          )}

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Seu financeiro começa
            <br />
            <div className="h-20 sm:h-24 lg:h-32 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentBenefit}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent inline-block"
                >
                  {ROTATING_BENEFITS[currentBenefit]}
                </motion.span>
              </AnimatePresence>
            </div>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Entrada manual e importação ficam grátis desde o primeiro dia. Premium libera planejamento, contas, investimentos e quanto ainda você pode gastar.
          </p>

          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            Você começa usando o núcleo grátis e decide depois se quer desbloquear os recursos premium.
          </p>

          <Button
            size="lg"
            onClick={startFree}
            className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105 mb-16"
          >
            Começar grátis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>

        <VideoSection videoUrl={import.meta.env.VITE_FOUNDER_VIDEO_URL} />
      </div>
    </section>
  );
}
