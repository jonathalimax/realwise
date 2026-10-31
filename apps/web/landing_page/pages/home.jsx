import React, { useEffect } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import HowItWorks from '../components/landing/HowItWorks';
import SummaryShowcase from '../components/landing/SummaryShowcase';
import AIFeatures from '../components/landing/AIFeatures';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import LeadCapture from '../components/landing/LeadCapture';
import { trackLandingView } from '../landingTracking';
import FooterSection from '../components/landing/FooterSection';
import WhatsAppFloatingButton from '../components/landing/WhatsAppFloatingButton';

export default function Home() {
  useEffect(() => {
    trackLandingView();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-x-hidden">
      <Header />
      <div className="pt-20">
        <HeroSection />
        <HowItWorks />
        <SummaryShowcase />
        <AIFeatures />
        <PricingSection />
        <FAQSection />
        <LeadCapture />
        <FinalCTASection />
        <FooterSection />
      </div>
      <WhatsAppFloatingButton />
    </div>
  );
}
