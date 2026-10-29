import React from 'react';
import { ArrowRight } from 'lucide-react';
import CtaButton from './CtaButton';
import { landingAnalytics } from '../../landingAnalytics';

export default function FinalCTASection() {
  const start = () => {
    landingAnalytics.trackCtaClicked('Começar grátis', 'final-cta');
    sessionStorage.setItem('__rw_show_login', '1');
    window.location.href = '/login';
  };
  return (
    <section data-section="final-cta" className="px-6 pb-24">
      <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 px-8 py-14 text-center text-white shadow-2xl shadow-violet-600/25">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Conte o que você quer conquistar.</h2>
        <p className="mx-auto mt-3 max-w-md text-violet-100">O Elio monta o seu plano e organiza o resto. 3 dias grátis, sem cartão e sem pagar nada.</p>
        <CtaButton onClick={start} tone="white" className="mt-8 px-8">
          Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
        </CtaButton>
      </div>
    </section>
  );
}
