import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import VideoSection from './VideoSection';

export default function HeroSection({ onBuy, couponCode = '' }) {
  return (
    <section data-section="hero" className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-200/20 dark:bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-200/20 dark:bg-indigo-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200/50 dark:border-violet-800/50">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              Pagamento único · 30 dias de garantia · Seus dados só seus
            </span>
          </div>

          {couponCode && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                Cupom <span className="font-mono font-bold text-violet-300 ml-0.5">{couponCode}</span> ativo
              </div>
            </div>
          )}

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            A sua planilha financeira
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              que se preenche sozinha.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-2 leading-relaxed">
            Importe seu extrato e veja pra onde vai cada real — automático e 100% seu, no seu Google.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10 mt-8">
            <Button
              size="lg"
              onClick={() => { landingAnalytics.trackCtaClicked('Quero o meu acesso', 'hero'); onBuy(); }}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Quero o meu acesso
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
              Acesso vitalício · Sem assinatura · 30 dias de garantia
            </p>
          </div>

          <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
            Feito no Brasil, por quem cansou de planilha morta e de app que quer ler todas as suas contas.
          </p>

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

        <VideoSection videoUrl={import.meta.env.VITE_FOUNDER_VIDEO_URL} />
      </div>
    </section>
  );
}
