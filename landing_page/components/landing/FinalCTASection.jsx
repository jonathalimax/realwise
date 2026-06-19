import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { calculatePrice, formatPrice } from '../../utils/couponValidator';

const FALLBACK_PRICING = { basePriceCents: 23880, installments: 12, activeCouponCode: null };

export default function FinalCTASection({ onBuy }) {
  const [pricing, setPricing] = useState(FALLBACK_PRICING);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data) setPricing(data);
    });
    return () => unsub();
  }, []);

  // Calculate installment price
  const INSTALLMENTS = 12;
  const installmentCents = Math.round(pricing.basePriceCents / INSTALLMENTS);

  function fmt(cents) {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  }

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
            Pare de alugar.
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Comece a possuir.
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto">
            Compre uma vez. Use para sempre.
          </p>
          <Button
            size="lg"
            onClick={() => { landingAnalytics.trackCtaClicked('Comprar Agora', 'final-cta'); onBuy(); }}
            className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
          >
            Comprar Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
            {INSTALLMENTS}x de {fmt(installmentCents)} · Acesso vitalício · 30 dias de garantia
          </p>
        </motion.div>
      </div>
    </section>
  );
}
