import React from 'react';
import { motion } from 'framer-motion';
import { X, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import WhatsAppButton from '@/components/WhatsAppButton';

function FailureContent() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"
        >
          <X className="w-10 h-10 text-rose-600" />
        </motion.div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          {language === 'pt' ? 'Pagamento não realizado' : 'Payment not completed'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          {language === 'pt'
            ? 'O pagamento foi cancelado ou ocorreu um erro. Você pode tentar novamente ou entrar em contato conosco.'
            : 'The payment was cancelled or an error occurred. You can try again or contact us.'}
        </p>

        <div className="space-y-3">
          <Link to="/checkout">
            <Button className="w-full h-12 text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <RefreshCcw className="w-5 h-5 mr-2" />
              {language === 'pt' ? 'Tentar novamente' : 'Try again'}
            </Button>
          </Link>

          <Link to="/">
            <Button variant="outline" className="w-full h-12 rounded-xl">
              <ArrowLeft className="w-5 h-5 mr-2" />
              {language === 'pt' ? 'Voltar ao início' : 'Back to home'}
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function PurchaseFailure() {
  return (
    <LanguageProvider>
      <FailureContent />
      <WhatsAppButton message="Olá! Tive um problema com o pagamento do Limas Finance e preciso de ajuda." />
    </LanguageProvider>
  );
}
