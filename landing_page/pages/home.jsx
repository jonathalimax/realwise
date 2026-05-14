import React, { useState } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import ProductShowcaseSection from '../components/landing/ProductShowcaseSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
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
        <DataOwnershipSection />
        <ProductShowcaseSection />
        <PricingSection onBuy={() => setCheckoutOpen(true)} />
        <FAQSection />
        <FinalCTASection onBuy={() => setCheckoutOpen(true)} />
        <FooterSection />
      </div>
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}
