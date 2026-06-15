import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

export default function HeroSection({ onBuy, couponCode = '' }) {
  return (
    <section data-section="hero" className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-200/20 dark:bg-teal-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Pagamento único · Acesso vitalício
            </span>
          </div>

          {couponCode && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                Cupom <span className="font-mono font-bold text-emerald-300 ml-0.5">{couponCode}</span> ativo
              </div>
            </div>
          )}

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Clareza sobre o seu dinheiro,
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              sem assinar mais nada.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-2 leading-relaxed">
            Veja para onde seu dinheiro vai, organize contas e cartões, e pare de depender de planilha — tudo sem mensalidade e sem que ninguém acesse seus dados.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10 mt-8">
            <Button
              size="lg"
              onClick={() => { landingAnalytics.trackCtaClicked('Assumir o controle', 'hero'); onBuy(); }}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Assumir o controle
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 dark:text-slate-500 mb-16">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Pagamento único
            </span>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </span>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 relative"
        >
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-lg" />
            <div className="relative rounded-2xl overflow-hidden">
              <img
                src="/screenshot-desktop.png"
                alt="Dashboard Realwise"
                className="hidden md:block w-full h-auto"
              />
              <img
                src="/screenshot-mobile.png"
                alt="Dashboard Realwise mobile"
                className="md:hidden w-full h-auto"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
