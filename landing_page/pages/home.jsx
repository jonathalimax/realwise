import React, { useState } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import WhyMoneywiseSection from '../components/landing/WhyMoneywiseSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FooterSection from '../components/landing/FooterSection';
import CheckoutModal from '../components/landing/CheckoutModal';

export default function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <Header onBuy={() => setCheckoutOpen(true)} />
      <div className="pt-20">
        <HeroSection onBuy={() => setCheckoutOpen(true)} />
        <PainPointsSection />
        <FeaturesSection />
        <WhyMoneywiseSection />
        <PricingSection onBuy={() => setCheckoutOpen(true)} />
        <FAQSection />
        <FooterSection onBuy={() => setCheckoutOpen(true)} />
      </div>
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}
