import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

export default function FinalCTASection() {
  return (
    <section data-section="final-cta" className="py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Teste grátis por 3 dias.
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Assine só se fizer sentido.
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto">
            Crie sua conta, importe seus extratos e veja seu mês com clareza antes de decidir. Sem cartão para começar.
          </p>
          <Button
            size="lg"
            onClick={() => { landingAnalytics.trackCtaClicked('Começar grátis', 'final-cta'); window.location.href = '/login'; }}
            className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
          >
            Começar teste grátis
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
            Planos mensal e anual · cancele quando quiser
          </p>
        </motion.div>
      </div>
    </section>
  );
}
