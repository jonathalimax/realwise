import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Mail, ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

const DEV_HOSTNAMES = new Set(['realwise-dev.web.app', 'realwise-dev.firebaseapp.com']);
const CLIENT_CONFIG_URL = DEV_HOSTNAMES.has(window.location.hostname)
  ? '/clients/app.dev.json'
  : '/clients/app.json';

async function getPixFirestore() {
  const existing = getApps().find(a => a.name === 'pix-listener');
  if (existing) return getFirestore(existing);
  const res = await fetch(CLIENT_CONFIG_URL);
  const config = await res.json();
  const app = initializeApp(config.firebase, 'pix-listener');
  return getFirestore(app);
}

export default function PurchaseSuccess() {
  const [isPending, setIsPending] = useState(
    new URLSearchParams(window.location.search).get('pending') === '1'
  );
  const [pendingType, setPendingType] = useState('pix'); // 'pix' | 'card'
  const [pixCode, setPixCode] = useState('');
  const [pixQr, setPixQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isPending) return;

    const code = sessionStorage.getItem('pix_code') || '';
    const qr = sessionStorage.getItem('pix_qr_base64') || '';
    const docId = sessionStorage.getItem('pix_doc_id') || '';
    const type = sessionStorage.getItem('pending_type') || 'pix';
    setPixCode(code);
    setPixQr(qr);
    setPendingType(type);
    sessionStorage.removeItem('pix_code');
    sessionStorage.removeItem('pix_qr_base64');
    sessionStorage.removeItem('pending_type');

    if (!docId) return;

    let unsub = () => {};
    // Listen for the webhook updating pending_payments/{docId}.status → 'approved'
    getPixFirestore().then((db) => {
      unsub = onSnapshot(
        doc(db, 'pending_payments', docId),
        (snap) => {
          if (snap.exists() && snap.data().status === 'approved') {
            unsub();
            sessionStorage.removeItem('pix_email');
            sessionStorage.removeItem('pix_doc_id');
            setIsPending(false);
            setPixCode('');
            setPixQr('');
          }
        },
        () => { /* permission error — silently ignore */ }
      );
    });

    return () => unsub();
  }, []);

  function handleCopy() {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 ${isPending ? 'bg-amber-50 dark:bg-amber-950/50' : 'bg-emerald-50 dark:bg-emerald-950/50'}`}>
          {isPending
            ? <Clock className="w-10 h-10 text-amber-500" />
            : <CheckCircle className="w-10 h-10 text-emerald-500" />
          }
        </div>

        <h1 className="text-3xl font-bold mb-4">
          {!isPending
            ? 'Pagamento confirmado!'
            : pendingType === 'card'
              ? 'Pagamento em análise'
              : 'Pix gerado!'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
          {!isPending
            ? <>Obrigado pela compra! Em breve você receberá um e-mail com as instruções de acesso ao Realwise.</>
            : pendingType === 'card'
              ? <>Seu acesso está sendo configurado e chega no seu e-mail. Qualquer coisa, <a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium">me chama no WhatsApp</a> agora — quem responde sou eu.</>
              : <>Escaneie o QR code ou copie o código Pix no seu app do banco. Seu acesso está sendo configurado e chega no seu e-mail. Qualquer coisa, <a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-medium">me chama no WhatsApp</a> agora — quem responde sou eu.</>
          }
        </p>

        {isPending && pixCode && (
          <div className="mb-8 space-y-4">
            {pixQr && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixQr}`}
                  alt="QR Code Pix"
                  className="w-48 h-48 rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 text-left font-medium">
                Pix Copia e Cola
              </div>
              <div className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 break-all text-left font-mono bg-white dark:bg-slate-950 select-all">
                {pixCode}
              </div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors"
              >
                {copied
                  ? <><Check className="w-4 h-4" />Copiado!</>
                  : <><Copy className="w-4 h-4" />Copiar código Pix</>
                }
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              Código válido por 30 minutos · Verifique o e-mail após o pagamento
            </p>
          </div>
        )}

        {isPending && pendingType === 'card' && (
          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mb-8">
            <div className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
              <Mail className="w-5 h-5 shrink-0" />
              <p>Você receberá um e-mail assim que o banco confirmar o pagamento.</p>
            </div>
          </div>
        )}

        {!isPending && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-8">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p>Verifique sua caixa de entrada (e o spam) nas próximas horas.</p>
            </div>
          </div>
        )}

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
