import React, { useState, useEffect } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import FooterSection from '../components/landing/FooterSection';
import WhyRealwiseSection from '../components/landing/WhyRealwiseSection';
import CheckoutModal from '../components/landing/CheckoutModal';
import { landingAnalytics } from '../landingAnalytics';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export default function Home({ couponCode = '' }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSection, setCheckoutSection] = useState('');
  const [checkoutPrefill, setCheckoutPrefill] = useState(
    couponCode ? { coupon: couponCode } : {}
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === '1') {
      const email = params.get('email') || '';
      const coupon = params.get('coupon') || '';
      const name = params.get('name') || '';
      const whatsapp = params.get('whatsapp') || '';
      setCheckoutOpen(true);
      if (email || coupon || name) {
        setCheckoutPrefill({ email, coupon, name, whatsapp });
      }
    }
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => landingAnalytics.init(GA_MEASUREMENT_ID);
  }, []);

  function openCheckout(section) {
    setCheckoutSection(section);
    setCheckoutOpen(true);
    landingAnalytics.trackCheckoutOpened(section);
  }

  function closeCheckout(reason, fieldsFilled) {
    setCheckoutOpen(false);
    landingAnalytics.trackCheckoutClosed(reason, fieldsFilled);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <Header onBuy={() => openCheckout('header')} />
      <div className="pt-20">
        <HeroSection onBuy={() => openCheckout('hero')} couponCode={couponCode} />
        <PainPointsSection />
        <FeaturesSection />
        <DataOwnershipSection />
        <WhyRealwiseSection />
        <PricingSection onBuy={() => openCheckout('pricing')} couponCode={couponCode} />
        <FAQSection />
        <FinalCTASection onBuy={() => openCheckout('final-cta')} />
        <FooterSection />
      </div>
      <CheckoutModal
        open={checkoutOpen}
        section={checkoutSection}
        onClose={closeCheckout}
        prefill={checkoutPrefill}
      />
    </div>
  );
}
