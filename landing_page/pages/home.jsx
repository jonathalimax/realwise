import React from 'react';
import { LanguageProvider } from '@/components/LanguageToggle';
import Header from '@/components/landing/Header';
import HeroSection from '@/components/landing/HeroSection';
import BenefitsSection from '@/components/landing/BenefitsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import BetaSection from '@/components/landing/BetaSection';
import FAQSection from '@/components/landing/FAQSection';
import FooterSection from '@/components/landing/FooterSection';

export default function Home() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
        <Header />
        <div className="pt-20">
          <HeroSection />
          <BenefitsSection />
          <FeaturesSection />
          <PricingSection />
          <BetaSection />
          <FAQSection />
          <FooterSection />
        </div>
      </div>
    </LanguageProvider>
  );
}