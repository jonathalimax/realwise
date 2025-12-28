import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  ArrowLeft,
  Gift,
  Users,
  TrendingUp,
  FileText,
  ExternalLink,
  Check,
  Copy,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WhatsAppButton from '@/components/WhatsAppButton';
import { PageSkeleton } from '@/components/ui/shimmer';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const donationAmounts = [25, 50, 100, 200];

function DonationsContent() {
  const { t, loading: cmsLoading } = useLanguage();
  const [selectedAmount, setSelectedAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [pix, setPix] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadPix = async () => {
      try {
        const pixDoc = await getDoc(doc(db, 'cms', 'pix'));
        if (pixDoc.exists()) {
          setPix(pixDoc.data());
        }
      } catch (error) {
        console.error('Error loading PIX:', error);
      }
    };
    loadPix();
  }, []);

  const copyPixKey = () => {
    if (pix?.key) {
      navigator.clipboard.writeText(pix.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmount = (value) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const currentAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const churchDonation = currentAmount ? (currentAmount * 0.5).toFixed(2) : 0;

  if (cmsLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link 
            to={createPageUrl('Home')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('nav.back')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold">Limas Finance</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/50 mb-6">
            <Heart className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t('donations.title')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('donations.subtitle')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Donation Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-2xl font-bold mb-6">{t('donations.title')}</h2>
              
              {/* Amount selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">{t('donations.select')}</label>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {donationAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleAmountSelect(amount)}
                      className={`py-3 rounded-xl font-semibold transition-all ${
                        selectedAmount === amount
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      R${amount}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                  <Input
                    type="number"
                    placeholder={t('donations.custom')}
                    value={customAmount}
                    onChange={(e) => handleCustomAmount(e.target.value)}
                    className="h-12 pl-8 rounded-xl"
                  />
                </div>
              </div>

              {/* Impact preview */}
              {currentAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 mb-6 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">{t('donations.impact')}</span>
                  </div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    <strong>R$ {churchDonation}</strong> {t('donations.impact.desc')}
                  </p>
                </motion.div>
              )}

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">{t('donations.paymentMethod') || 'Método de pagamento'}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      paymentMethod === 'pix'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    PIX
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      paymentMethod === 'card'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    {t('donations.card') || 'Cartão'}
                  </button>
                </div>
              </div>

              {/* PIX Payment */}
              {paymentMethod === 'pix' && pix?.key && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-6 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  <div className="text-center mb-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {t('donations.pixInstructions') || 'Copie a chave PIX ou escaneie o QR Code'}
                    </p>
                    {pix.beneficiary && (
                      <p className="font-medium text-slate-900 dark:text-white">{pix.beneficiary}</p>
                    )}
                  </div>

                  {pix.qrCodeUrl && (
                    <div className="flex justify-center mb-4">
                      <img src={pix.qrCodeUrl} alt="QR Code PIX" className="w-40 h-40 rounded-lg" />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg px-4 py-3 font-mono text-sm truncate border border-slate-200 dark:border-slate-700">
                      {pix.key}
                    </div>
                    <Button
                      onClick={copyPixKey}
                      variant={copied ? "emerald" : "outline"}
                      className="h-12 px-4 rounded-lg"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3">
                    {t('donations.pixNote') || 'Após o pagamento, envie o comprovante para confirmação'}
                  </p>
                </motion.div>
              )}

              {/* Card Payment Form */}
              {paymentMethod === 'card' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('donations.name')}</label>
                      <Input placeholder={t('donations.name.placeholder')} className="h-12 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('donations.email')}</label>
                      <Input type="email" placeholder={t('donations.email.placeholder')} className="h-12 rounded-xl" />
                    </div>
                  </div>

                  <Button
                    className="w-full h-14 text-lg rounded-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={!currentAmount || currentAmount <= 0}
                  >
                    <Heart className="w-5 h-5 mr-2" />
                    {t('donations.donate')} R$ {currentAmount || 0}
                  </Button>

                  <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                    {t('donations.secure')}
                  </p>
                </motion.div>
              )}

              {/* PIX - No key configured message */}
              {paymentMethod === 'pix' && !pix?.key && (
                <div className="mb-6 p-6 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-center">
                  <QrCode className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    {t('donations.pixNotConfigured') || 'PIX ainda não configurado. Use cartão ou tente novamente mais tarde.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Impact Reports - Coming Soon */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-6">{t('donations.reports')}</h2>

            {/* Coming Soon Message */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {t('donations.comingSoon') || 'Relatórios em breve'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                {t('donations.comingSoonDesc') || 'Assim que recebermos as primeiras doações, publicaremos relatórios detalhados de transparência aqui.'}
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default function Donations() {
  return (
    <LanguageProvider>
      <DonationsContent />
      <WhatsAppButton />
    </LanguageProvider>
  );
}