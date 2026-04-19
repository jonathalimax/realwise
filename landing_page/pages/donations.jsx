import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  ArrowLeft, 
  Gift,
  Users,
  TrendingUp,
  FileText,
  ExternalLink,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

const donationAmounts = [10, 25, 50, 100];

const impactReports = [
  { month: 'December 2024', raised: 2450, donated: 2450, recipients: ['Development', 'Infrastructure'] },
  { month: 'November 2024', raised: 1890, donated: 1890, recipients: ['New Features', 'Bug Fixes'] },
  { month: 'October 2024', raised: 1650, donated: 1650, recipients: ['Server Costs', 'Development Tools'] },
];

function DonationsContent() {
  const { t } = useLanguage();
  const [selectedAmount, setSelectedAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState('');

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmount = (value) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const currentAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const donationAmount = currentAmount ? currentAmount.toFixed(2) : 0;

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
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold">Moneywise</span>
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
                      ${amount}
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
                    <strong>R$ {donationAmount}</strong> {t('donations.impact.desc')}
                  </p>
                </motion.div>
              )}

              {/* Form fields */}
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
            </div>
          </motion.div>

          {/* Impact Reports */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-6">{t('donations.reports')}</h2>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800">
                <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">R$ 5.990</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('donations.raised')}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800">
                <Heart className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">R$ 2.995</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('donations.donated')}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800">
                <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">89</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('donations.donors')}</p>
              </div>
            </div>

            {/* Monthly reports */}
            <div className="space-y-4">
              {impactReports.map((report, index) => (
                <motion.div
                  key={report.month}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{report.month}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        ${report.raised} raised · ${report.donated} donated
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                      <FileText className="w-4 h-4 mr-1" />
                      {t('donations.report')}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.recipients.map((recipient, i) => (
                      <span 
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                      >
                        <Check className="w-3 h-3" />
                        {recipient}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
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
    </LanguageProvider>
  );
}