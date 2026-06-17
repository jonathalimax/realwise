import React, { useState, useEffect } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import LiveImportDemo from '../components/landing/LiveImportDemo';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import FounderStory from '../components/landing/FounderStory';
import Testimonials from '../components/landing/Testimonials';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import GuaranteeSection from '../components/landing/GuaranteeSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import FooterSection from '../components/landing/FooterSection';
import WhatsAppFloatingButton from '../components/landing/WhatsAppFloatingButton';
import CheckoutModal from '../components/landing/CheckoutModal';
import { landingAnalytics } from '../landingAnalytics';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

function getInitialCheckoutState(couponCode) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === '1') {
    const email = params.get('email') || '';
    const coupon = params.get('coupon') || '';
    const name = params.get('name') || '';
    const whatsapp = params.get('whatsapp') || '';
    return {
      open: true,
      prefill: email || coupon || name ? { email, coupon: coupon || couponCode, name, whatsapp } : { coupon: couponCode || '' }
    };
  }
  return {
    open: false,
    prefill: couponCode ? { coupon: couponCode } : {}
  };
}

export default function Home({ couponCode = '' }) {
  const initialCheckout = getInitialCheckoutState(couponCode);
  const [checkoutOpen, setCheckoutOpen] = useState(initialCheckout.open);
  const [checkoutSection, setCheckoutSection] = useState('');
  const [checkoutPrefill] = useState(initialCheckout.prefill);

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
        <LiveImportDemo />
        <DataOwnershipSection />
        <FounderStory />
        <Testimonials />
        <FeaturesSection />
        <PricingSection onBuy={() => openCheckout('pricing')} couponCode={couponCode} />
        <GuaranteeSection />
        <FAQSection />
        <FinalCTASection onBuy={() => openCheckout('final-cta')} />
        <FooterSection />
      </div>
      <WhatsAppFloatingButton />
      <CheckoutModal
        open={checkoutOpen}
        section={checkoutSection}
        onClose={closeCheckout}
        prefill={checkoutPrefill}
      />
    </div>
  );
}
