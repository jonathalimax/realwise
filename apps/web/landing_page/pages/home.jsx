import React, { useEffect } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import MobileDemo from '../components/landing/MobileDemo';
import FounderStory from '../components/landing/FounderStory';
import Testimonials from '../components/landing/Testimonials';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import GuaranteeSection from '../components/landing/GuaranteeSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import FooterSection from '../components/landing/FooterSection';
import WhatsAppFloatingButton from '../components/landing/WhatsAppFloatingButton';
import { landingAnalytics } from '../landingAnalytics';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export default function Home() {
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => landingAnalytics.init(GA_MEASUREMENT_ID);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-x-hidden">
      <Header />
      <div className="pt-20">
        <HeroSection />
        <MobileDemo />
        <FeaturesSection />
        <FounderStory />
        <Testimonials />
        <PricingSection />
        <GuaranteeSection />
        <FAQSection />
        <FinalCTASection />
        <FooterSection />
      </div>
      <WhatsAppFloatingButton />
    </div>
  );
}
