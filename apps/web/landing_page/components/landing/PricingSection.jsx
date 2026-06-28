import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { Check, ArrowRight, Lock, Shield, Smartphone, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import CouponInput from './CouponInput';
import { calculatePrice, calculateInstallment } from '../../utils/couponValidator';

const included = [
  'Acesso vitalício',
  'Suporte sempre que precisar',
  'Melhorias e correções gratuitas',
  'Base de dados 100% sua',
  '30 dias de garantia de arrependimento',
];

const trust = [
  { icon: Lock, text: '100% seguro (Mercado Pago)' },
  { icon: Shield, text: 'Dados 100% seus' },
  { icon: Smartphone, text: 'Desktop + Mobile' },
  { icon: Database, text: 'Seu Firebase' },
];

const FALLBACK_PRICING = { basePriceCents: 23880, installments: 12, activeCouponCode: null };

function fmt(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default function PricingSection({ onBuy, couponCode = '' }) {
  const [pricing] = useState(FALLBACK_PRICING);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // If couponCode is passed via URL, use it
  useEffect(() => {
    if (couponCode && !appliedCoupon) {
      // Auto-apply coupon from URL
      setAppliedCoupon({
        code: couponCode,
        discountPercent: 0, // Will be calculated on backend during checkout
      });
    }
  }, [couponCode, appliedCoupon]);

  const handleCouponApply = (coupon) => {
    setAppliedCoupon(coupon);
  };

  // Calculate final price
  const finalCents = appliedCoupon
    ? calculatePrice(pricing.basePriceCents, appliedCoupon.discountPercent)
    : pricing.basePriceCents;

  const installmentCents = calculateInstallment(finalCents, pricing.installments);
  const discountPercent = appliedCoupon ? appliedCoupon.discountPercent : 0;

  return (
    <section data-section="pricing" id="preco" className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Pague uma vez. Sem assinatura.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Sem mensalidade e sem renovação. Você compra o acesso e ele é seu.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <div className="relative rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-400 via-violet-400 to-cyan-400" />

            <div className="p-10 sm:p-12 space-y-8">
              <div className="text-center space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200/50 dark:border-violet-800/50 text-sm font-medium text-violet-700 dark:text-violet-300">
                    Pagamento único
                  </span>
                  {appliedCoupon && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200/50 dark:border-rose-800/50 text-sm font-bold text-rose-600 dark:text-rose-400">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
                <div className="text-center space-y-2">
                  <div className="text-lg text-slate-500 dark:text-slate-400">
                    {pricing.installments}x de
                  </div>
                  <div className="text-5xl font-bold tracking-tight">
                    {fmt(installmentCents)}
                  </div>
                  <div className="text-sm text-slate-400 dark:text-slate-500">
                    sem juros
                  </div>
                </div>
              </div>

              {/* Coupon Input */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <CouponInput onCouponApply={handleCouponApply} currentCoupon={appliedCoupon} />
              </div>

              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                onClick={() => { landingAnalytics.trackCtaClicked('Sim, Quero Acesso', 'pricing'); onBuy(); }}
                className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
              >
                Sim, Quero Acesso
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <div className="flex flex-wrap gap-4 justify-center">
                {trust.map((item) => (
                  <span
                    key={item.text}
                    className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500"
                  >
                    <item.icon className="w-3 h-3" />
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8"
        >
          Suporte, correções e melhorias incluídos. Novas funcionalidades são upgrades opcionais — você decide se quer.
        </motion.p>
      </div>
    </section>
  );
}
