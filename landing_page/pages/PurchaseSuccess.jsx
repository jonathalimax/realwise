import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PurchaseSuccess() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl font-bold mb-4">Pagamento confirmado!</h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
          Obrigado pela compra! Em até <strong>24 horas</strong> você receberá um e-mail com as instruções de acesso e configuração do seu Realwise.
        </p>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-8">
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Mail className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p>Verifique sua caixa de entrada (e o spam) nas próximas horas.</p>
          </div>
        </div>

        <Button
          onClick={() => { window.location.href = '/'; }}
          variant="outline"
          className="rounded-full border-slate-300 dark:border-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao início
        </Button>
      </motion.div>
    </div>
  );
}
