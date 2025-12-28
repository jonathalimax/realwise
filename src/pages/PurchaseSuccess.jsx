import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';

function SuccessContent() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);

  const status = searchParams.get('status');

  useEffect(() => {
    // Brief loading state
    const timer = setTimeout(() => {
      setChecking(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {checking ? (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              {language === 'pt' ? 'Processando pagamento...' : 'Processing payment...'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {language === 'pt'
                ? 'Aguarde enquanto confirmamos seu pagamento.'
                : 'Please wait while we confirm your payment.'}
            </p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500 flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
              {language === 'pt' ? 'Pagamento Confirmado!' : 'Payment Confirmed!'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {language === 'pt'
                ? 'Seu pagamento foi recebido com sucesso! Você receberá seu acesso em breve.'
                : 'Your payment was received successfully! You will receive your access soon.'}
            </p>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {language === 'pt'
                  ? 'Liberaremos seu acesso em até 24 horas. Você receberá uma confirmação por email ou WhatsApp.'
                  : 'We will grant your access within 24 hours. You will receive a confirmation via email or WhatsApp.'}
              </p>
            </div>

            <div className="space-y-3">
              <Link to="/">
                <Button variant="outline" className="w-full h-12 rounded-xl">
                  {language === 'pt' ? 'Voltar ao início' : 'Back to home'}
                </Button>
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function PurchaseSuccess() {
  return (
    <LanguageProvider>
      <SuccessContent />
    </LanguageProvider>
  );
}
