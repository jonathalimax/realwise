import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Shield,
  Heart,
  Loader2,
  Tag,
  X,
  ChevronDown,
  ArrowRight,
  CreditCard,
  Globe,
  Lock,
  Infinity,
  User,
  BookOpen,
  Headphones,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WhatsAppButton from '@/components/WhatsAppButton';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { analytics } from '@/utils/analytics';

// Helper function to translate Mercado Pago error codes to user-friendly messages
function getPaymentErrorMessage(statusDetail, language) {
  const errorMessages = {
    cc_rejected_bad_filled_card_number: {
      pt: 'Número do cartão incorreto. Verifique e tente novamente.',
      en: 'Incorrect card number. Please check and try again.',
    },
    cc_rejected_bad_filled_date: {
      pt: 'Data de validade incorreta. Verifique e tente novamente.',
      en: 'Incorrect expiration date. Please check and try again.',
    },
    cc_rejected_bad_filled_other: {
      pt: 'Dados do cartão incorretos. Verifique e tente novamente.',
      en: 'Incorrect card details. Please check and try again.',
    },
    cc_rejected_bad_filled_security_code: {
      pt: 'Código de segurança incorreto. Verifique e tente novamente.',
      en: 'Incorrect security code. Please check and try again.',
    },
    cc_rejected_blacklist: {
      pt: 'Pagamento não autorizado. Use outro cartão.',
      en: 'Payment not authorized. Please use another card.',
    },
    cc_rejected_call_for_authorize: {
      pt: 'Você precisa autorizar o pagamento com o banco.',
      en: 'You need to authorize the payment with your bank.',
    },
    cc_rejected_card_disabled: {
      pt: 'Cartão desabilitado. Contate sua operadora.',
      en: 'Card disabled. Please contact your card issuer.',
    },
    cc_rejected_card_error: {
      pt: 'Erro no cartão. Tente com outro cartão.',
      en: 'Card error. Please try with another card.',
    },
    cc_rejected_duplicated_payment: {
      pt: 'Pagamento duplicado. Já existe um pagamento com este valor.',
      en: 'Duplicate payment. A payment with this amount already exists.',
    },
    cc_rejected_high_risk: {
      pt: 'Pagamento recusado por segurança. Tente outro método.',
      en: 'Payment declined for security reasons. Try another method.',
    },
    cc_rejected_insufficient_amount: {
      pt: 'Saldo insuficiente. Tente outro cartão ou método.',
      en: 'Insufficient funds. Try another card or method.',
    },
    cc_rejected_invalid_installments: {
      pt: 'Número de parcelas inválido para este cartão.',
      en: 'Invalid number of installments for this card.',
    },
    cc_rejected_max_attempts: {
      pt: 'Limite de tentativas excedido. Tente outro cartão.',
      en: 'Maximum attempts exceeded. Try another card.',
    },
    cc_rejected_other_reason: {
      pt: 'Pagamento recusado. Tente outro método de pagamento.',
      en: 'Payment declined. Try another payment method.',
    },
  };

  const errorData = errorMessages[statusDetail];
  if (errorData) {
    return language === 'pt' ? errorData.pt : errorData.en;
  }

  // Default message for unknown error codes
  return language === 'pt'
    ? 'Pagamento recusado. Verifique os dados ou tente outro método.'
    : 'Payment declined. Check your details or try another method.';
}

function PurchaseContent() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const brickControllerRef = useRef(null);

  useEffect(() => {
    analytics.pageView('purchase');
  }, []);

  const [pricing, setPricing] = useState({ price: 99, discountPercent: 0, discountActive: false });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState('info'); // 'info' or 'payment'
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [brickReady, setBrickReady] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [pixGenerated, setPixGenerated] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [contribution, setContribution] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const pricingDoc = await getDoc(doc(db, 'cms', 'pricing'));
        if (pricingDoc.exists()) setPricing(pricingDoc.data());
      } catch (error) {
        console.error('Error loading data:', error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      const couponsRef = collection(db, 'coupons');
      const q = query(couponsRef, where('code', '==', couponCode.toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setCouponError(language === 'pt' ? 'Cupom não encontrado' : 'Coupon not found');
        setAppliedCoupon(null);
      } else {
        const couponData = snapshot.docs[0].data();

        if (!couponData.active) {
          setCouponError(language === 'pt' ? 'Cupom inativo' : 'Coupon inactive');
          setAppliedCoupon(null);
        } else if (couponData.expiresAt && new Date(couponData.expiresAt) < new Date()) {
          setCouponError(language === 'pt' ? 'Cupom expirado' : 'Coupon expired');
          setAppliedCoupon(null);
        } else if (couponData.maxUses && couponData.usedCount >= couponData.maxUses) {
          setCouponError(language === 'pt' ? 'Cupom esgotado' : 'Coupon limit reached');
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon(couponData);
          setCouponError('');
        }
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError(language === 'pt' ? 'Erro ao aplicar cupom' : 'Error applying coupon');
    }

    setCouponLoading(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Calculate final price
  let basePrice = pricing.price || 99;
  let totalDiscount = 0;

  if (pricing.discountActive && pricing.discountPercent > 0) {
    const validUntil = pricing.discountEndDate ? new Date(pricing.discountEndDate) : null;
    if (!validUntil || validUntil >= new Date()) {
      totalDiscount += pricing.discountPercent;
    }
  }

  if (appliedCoupon) {
    totalDiscount += appliedCoupon.discountPercent;
  }

  totalDiscount = Math.min(totalDiscount, 100);
  const discountedPrice = basePrice * (1 - totalDiscount / 100);
  const contributionAmount = contribution ? parseFloat(contribution) : 0;
  const finalPrice = discountedPrice + (contributionAmount > 0 ? contributionAmount : 0);

  // Store email and name in refs for use in callbacks
  const emailRef = useRef(email);
  const nameRef = useRef(name);
  const couponRef = useRef(appliedCoupon?.code);
  const priceRef = useRef(finalPrice);
  const contributionRef = useRef(contributionAmount);

  useEffect(() => {
    emailRef.current = email;
    nameRef.current = name;
    couponRef.current = appliedCoupon?.code;
    priceRef.current = finalPrice;
    contributionRef.current = contributionAmount;
  }, [email, name, appliedCoupon, finalPrice, contributionAmount]);

  // Initialize Payment Brick (transparent checkout - no preferenceId)
  const initPaymentBrick = useCallback(async () => {
    if (!window.MercadoPago || !publicKey) return;

    try {
      const mp = new window.MercadoPago(publicKey, {
        locale: language === 'pt' ? 'pt-BR' : 'en-US',
      });

      const bricksBuilder = mp.bricks();

      // Unmount existing brick if any
      if (brickControllerRef.current) {
        brickControllerRef.current.unmount();
      }

      const settings = {
        initialization: {
          amount: finalPrice,
          payer: {
            email: email,
            firstName: name.split(' ')[0] || '',
            lastName: name.split(' ').slice(1).join(' ') || '',
          },
        },
        customization: {
          visual: {
            style: {
              theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
              customVariables: {
                formBackgroundColor: 'transparent',
                baseColor: '#10b981',
              },
            },
            hideFormTitle: true,
            hidePaymentButton: false,
          },
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            ticket: 'all',
            bankTransfer: 'all',
            atm: 'all',
            mercadoPago: 'all',
            maxInstallments: 12,
          },
        },
        callbacks: {
          onReady: () => {
            setBrickReady(true);
            setPaymentLoading(false);
          },
          onSubmit: async ({ selectedPaymentMethod, formData }) => {
            // Return a promise - brick will wait for it to resolve/reject
            return new Promise(async (resolve, reject) => {
              try {
                setPaymentError('');

                const response = await fetch('/api/payment/process', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...formData,
                    email: emailRef.current,
                    name: nameRef.current,
                    couponCode: couponRef.current || null,
                    transaction_amount: priceRef.current,
                    contribution: contributionRef.current || 0,
                  }),
                });

                const result = await response.json();
                console.log('Payment result:', result);

                if (!response.ok) {
                  const errorMsg = result.error || 'Payment failed';
                  setPaymentError(errorMsg);
                  reject(new Error(errorMsg));
                  return;
                }

                // Check actual payment status from Mercado Pago
                if (result.status === 'approved') {
                  analytics.purchaseComplete(priceRef.current, couponRef.current, contributionRef.current || 0);
                  resolve();
                  setTimeout(() => navigate('/purchase/success'), 100);
                } else if (result.status === 'pending' || result.status === 'in_process') {
                  // For PIX: pending_waiting_transfer - don't navigate, let user see QR code
                  // For card: pending_contingency/in_process - payment under review
                  setPaymentId(result.id);

                  if (result.status_detail === 'pending_waiting_transfer') {
                    // PIX generated - show message but don't navigate
                    setPixGenerated(true);
                    resolve(); // Let brick show the QR code
                  } else if (result.status_detail === 'pending_contingency' || result.status === 'in_process') {
                    // Card payment under review - show pending message and poll
                    setPaymentPending(true);
                    resolve();
                  } else {
                    // Other pending payments (like boleto) - go to success with pending message
                    resolve();
                    setTimeout(() => navigate('/purchase/success'), 100);
                  }
                } else if (result.status === 'rejected') {
                  // Payment was rejected - show error and don't navigate
                  const errorMsg = getPaymentErrorMessage(result.status_detail, language);
                  setPaymentError(errorMsg);
                  reject(new Error(errorMsg));
                } else {
                  // Any other status - treat as failure
                  const errorMsg = result.status_detail || 'Payment not approved';
                  setPaymentError(errorMsg);
                  reject(new Error(errorMsg));
                }
              } catch (error) {
                console.error('Payment error:', error);
                setPaymentError(
                  language === 'pt'
                    ? 'Erro ao processar pagamento. Tente novamente.'
                    : 'Error processing payment. Try again.'
                );
                reject(error);
              }
            });
          },
          onError: (error) => {
            console.error('Brick error:', error);
            setPaymentError(
              language === 'pt'
                ? 'Erro no pagamento. Verifique os dados e tente novamente.'
                : 'Payment error. Check your details and try again.'
            );
          },
        },
      };

      brickControllerRef.current = await bricksBuilder.create('payment', 'payment-brick-container', settings);
    } catch (error) {
      console.error('Error initializing brick:', error);
      setPaymentError(
        language === 'pt'
          ? 'Erro ao inicializar pagamento. Recarregue a página.'
          : 'Error initializing payment. Reload the page.'
      );
      setPaymentLoading(false);
    }
  }, [publicKey, email, name, finalPrice, language, navigate]);

  useEffect(() => {
    if (step === 'payment' && publicKey) {
      initPaymentBrick();
    }

    return () => {
      if (brickControllerRef.current) {
        brickControllerRef.current.unmount();
      }
    };
  }, [step, publicKey, initPaymentBrick]);

  // Poll for payment completion (PIX or pending card payments)
  useEffect(() => {
    if ((!pixGenerated && !paymentPending) || !paymentId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment/status?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.approved) {
          clearInterval(pollInterval);
          analytics.purchaseComplete(finalPrice, appliedCoupon?.code, contributionAmount || 0);
          navigate('/purchase/success');
        } else if (data.rejected) {
          clearInterval(pollInterval);
          setPaymentPending(false);
          setPixGenerated(false);
          setPaymentError(
            language === 'pt'
              ? 'Pagamento recusado. Tente outro método de pagamento.'
              : 'Payment declined. Try another payment method.'
          );
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [pixGenerated, paymentPending, paymentId, email, finalPrice, appliedCoupon, contributionAmount, language, navigate]);

  // Handle continue to payment
  const handleContinueToPayment = async () => {
    if (!email) {
      setPaymentError(language === 'pt' ? 'Informe seu email' : 'Enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setPaymentError(language === 'pt' ? 'Email inválido' : 'Invalid email');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    analytics.purchaseStart(finalPrice, appliedCoupon?.code || null, contributionAmount || 0);

    try {
      // Get public key from backend
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          name: name,
          price: finalPrice,
          couponCode: appliedCoupon?.code || null,
          contribution: contributionAmount || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating payment');
      }

      if (!data.publicKey) {
        throw new Error('Public key not configured');
      }

      setPublicKey(data.publicKey);
      setStep('payment');
    } catch (error) {
      console.error('Error:', error);
      setPaymentError(
        language === 'pt'
          ? 'Erro ao processar. Tente novamente.'
          : 'Error processing. Try again.'
      );
      setPaymentLoading(false);
    }
  };

  const benefits = [
    {
      icon: User,
      title: language === 'pt' ? 'Sua própria conta' : 'Your own account',
      desc: language === 'pt' ? 'Sistema configurado na sua conta Google/Firebase' : 'System configured in your Google/Firebase account'
    },
    {
      icon: Key,
      title: language === 'pt' ? 'Seus dados, seu controle' : 'Your data, your control',
      desc: language === 'pt' ? 'Você é dono dos seus dados financeiros' : 'You own all your financial data'
    },
    {
      icon: Infinity,
      title: language === 'pt' ? 'Sem custo de hospedagem' : 'No hosting costs',
      desc: language === 'pt' ? 'Firebase gratuito para uso pessoal' : 'Firebase free tier for personal use'
    },
    {
      icon: BookOpen,
      title: language === 'pt' ? 'Tutoriais online' : 'Online tutorials',
      desc: language === 'pt' ? 'Páginas de ajuda para usar o sistema' : 'Help pages to guide you through the system'
    },
    {
      icon: Headphones,
      title: language === 'pt' ? 'Suporte incluído' : 'Support included',
      desc: language === 'pt' ? '2 alterações grátis para bugs ou configs' : '2 free changes for bugs or configs'
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {step === 'payment' ? (
            <button
              onClick={() => {
                setStep('info');
                setBrickReady(false);
                if (brickControllerRef.current) {
                  brickControllerRef.current.unmount();
                }
              }}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{language === 'pt' ? 'Voltar' : 'Back'}</span>
            </button>
          ) : (
            <Link
              to="/"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{language === 'pt' ? 'Voltar' : 'Back'}</span>
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold hidden sm:block">Limas Finance</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-6 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
              {step === 'info'
                ? (language === 'pt' ? 'Finalizar Compra' : 'Complete Purchase')
                : (language === 'pt' ? 'Pagamento' : 'Payment')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {language === 'pt' ? 'Acesso ao Limas Finance' : 'Access to Limas Finance'}
            </p>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'info' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600'
              }`}>
                {step === 'payment' ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="w-12 h-0.5 bg-slate-200 dark:bg-slate-700" />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'payment' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                2
              </div>
            </div>
          </div>

          {step === 'info' ? (
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Left: What You Get */}
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">
                    {language === 'pt' ? 'O que você recebe' : 'What you get'}
                  </h2>

                  <div className="space-y-4">
                    {benefits.map((benefit, i) => (
                      <div key={i} className="flex gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                          <benefit.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200">{benefit.title}</p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{benefit.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-4"
                  >
                    {language === 'pt' ? 'Como funciona?' : 'How does it work?'}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  </button>

                  {showDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 space-y-2"
                    >
                      <p>
                        {language === 'pt'
                          ? '1. Após o pagamento, você será contatado via email.'
                          : '1. After payment, you\'ll be contacted via email.'}
                      </p>
                      <p>
                        {language === 'pt'
                          ? '2. O sistema será configurado na sua conta Google/Firebase - seus dados são 100% seus.'
                          : '2. The system will be configured in your Google/Firebase account - your data is 100% yours.'}
                      </p>
                      <p>
                        {language === 'pt'
                          ? '3. Você receberá tutoriais online para aprender a usar.'
                          : '3. You\'ll get online tutorials to learn how to use it.'}
                      </p>
                      <p className="pt-2 text-xs text-slate-500 dark:text-slate-500">
                        {language === 'pt'
                          ? 'Nota: O código fonte não está incluído. Acesso ao código tem custo adicional - entre em contato via suporte.'
                          : 'Note: Source code is not included. Code access has an additional cost - contact support.'}
                      </p>
                      <p className="pt-1 font-medium text-slate-700 dark:text-slate-300">
                        {language === 'pt'
                          ? '• Garantia de reembolso de 30 dias.'
                          : '• 30-day money-back guarantee.'}
                      </p>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <div>
                    <p className="font-medium text-sm">
                      {language === 'pt' ? 'Compra Segura' : 'Secure Purchase'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'pt' ? 'Pagamento processado pelo Mercado Pago' : 'Payment processed by Mercado Pago'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Info Form */}
              <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
                {/* Price Summary */}
                <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2 text-sm sm:text-base">
                    <span className="text-slate-600 dark:text-slate-400">
                      {language === 'pt' ? 'Subtotal' : 'Subtotal'}
                    </span>
                    <span className={totalDiscount > 0 ? 'line-through text-slate-400' : ''}>
                      R$ {basePrice.toFixed(2)}
                    </span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between mb-2 text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                      <span>{language === 'pt' ? 'Desconto' : 'Discount'} ({totalDiscount}%)</span>
                      <span>- R$ {(basePrice - discountedPrice).toFixed(2)}</span>
                    </div>
                  )}

                  {contributionAmount > 0 && (
                    <div className="flex items-center justify-between mb-2 text-sm sm:text-base text-rose-600 dark:text-rose-400">
                      <span>{language === 'pt' ? 'Contribuição' : 'Contribution'}</span>
                      <span>+ R$ {contributionAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xl sm:text-2xl font-bold">
                    <span>Total</span>
                    <span className="text-emerald-600 dark:text-emerald-400">R$ {finalPrice.toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {language === 'pt' ? 'Pagamento único' : 'One-time payment'}
                  </p>
                </div>

                {/* Coupon */}
                <div className="mb-4 sm:mb-6">
                  <label className="block text-xs sm:text-sm font-medium mb-2">
                    {language === 'pt' ? 'Cupom de desconto' : 'Discount coupon'}
                  </label>

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          -{appliedCoupon.discountPercent}%
                        </span>
                      </div>
                      <button onClick={removeCoupon} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="CODIGO"
                        className="h-11 rounded-xl uppercase font-mono"
                      />
                      <Button
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        variant="outline"
                        className="h-11 px-4 rounded-xl"
                      >
                        {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'pt' ? 'Aplicar' : 'Apply')}
                      </Button>
                    </div>
                  )}

                  {couponError && (
                    <p className="text-sm text-rose-500 mt-2">{couponError}</p>
                  )}
                </div>

                {/* Optional Contribution */}
                <div className="mb-4 sm:mb-6">
                  <label className="block text-xs sm:text-sm font-medium mb-2">
                    <Heart className="w-4 h-4 inline mr-1 text-rose-500" />
                    {language === 'pt' ? 'Contribuição extra (opcional)' : 'Extra contribution (optional)'}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {language === 'pt'
                      ? 'Quer apoiar o desenvolvimento? Adicione uma contribuição voluntária.'
                      : 'Want to support development? Add a voluntary contribution.'}
                  </p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={contribution}
                      onChange={(e) => setContribution(e.target.value)}
                      placeholder="0"
                      className="h-11 pl-10 rounded-xl"
                    />
                  </div>
                </div>

                {/* User Info */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'pt' ? 'Seu nome' : 'Your name'}
                    </label>
                    <Input
                      type="text"
                      name="name"
                      autoComplete="name"
                      inputMode="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={language === 'pt' ? 'João Silva' : 'John Doe'}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'pt' ? 'Seu email' : 'Your email'} *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setPaymentError('');
                      }}
                      placeholder="email@exemplo.com"
                      className="h-11 rounded-xl"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'pt'
                        ? 'Este email será liberado para acessar o app após o pagamento.'
                        : 'This email will be granted access after payment.'}
                    </p>
                  </div>
                </div>

                {paymentError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 mb-4">
                    <p className="text-sm text-rose-600 dark:text-rose-400">{paymentError}</p>
                  </div>
                )}

                {/* Continue Button */}
                <Button
                  onClick={handleContinueToPayment}
                  disabled={paymentLoading || !email}
                  className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {paymentLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 mr-2" />
                  )}
                  {language === 'pt' ? 'Continuar para pagamento' : 'Continue to payment'}
                </Button>

                {/* Payment Methods Icons */}
                <div className="flex items-center justify-center gap-3 mt-4 text-slate-400">
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-medium">
                    <span className="text-[#32BCAD]">PIX</span>
                  </div>
                  <CreditCard className="w-6 h-6" />
                  <span className="text-xs">Visa</span>
                  <span className="text-xs">Master</span>
                  <span className="text-xs">Amex</span>
                </div>
              </div>
            </div>
          ) : (
            /* Payment Step - Checkout Brick */
            <div className="max-w-xl mx-auto">
              <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
                {/* Order Summary */}
                <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 dark:text-slate-400">Limas Finance - Acesso Completo</span>
                    <span className="font-bold text-emerald-600">R$ {finalPrice.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{email}</p>
                </div>

                {paymentError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800 mb-4">
                    <p className="text-sm text-rose-600 dark:text-rose-400">{paymentError}</p>
                  </div>
                )}

                {/* PIX Generated Message */}
                {pixGenerated && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-emerald-700 dark:text-emerald-300">
                        {language === 'pt' ? 'PIX gerado com sucesso!' : 'PIX generated successfully!'}
                      </h3>
                    </div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">
                      {language === 'pt'
                        ? 'Escaneie o QR Code ou copie o código PIX abaixo para completar o pagamento.'
                        : 'Scan the QR Code or copy the PIX code below to complete your payment.'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {language === 'pt'
                        ? 'Aguardando confirmação do pagamento...'
                        : 'Waiting for payment confirmation...'}
                    </div>
                  </div>
                )}

                {/* Card Payment Under Review Message */}
                {paymentPending && !pixGenerated && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                      <h3 className="font-bold text-amber-700 dark:text-amber-300">
                        {language === 'pt' ? 'Pagamento em análise' : 'Payment under review'}
                      </h3>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                      {language === 'pt'
                        ? 'Seu pagamento está sendo processado. Isso pode levar alguns instantes.'
                        : 'Your payment is being processed. This may take a few moments.'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {language === 'pt'
                        ? 'Verificando status do pagamento...'
                        : 'Checking payment status...'}
                    </div>
                  </div>
                )}

                {/* Payment Brick Container */}
                <style>{`
                  /* Fix Mercado Pago brick button on mobile */
                  #payment-brick-container button[type="submit"],
                  #payment-brick-container .mp-checkout-button,
                  #payment-brick-container [class*="button"] {
                    min-height: 48px !important;
                    font-size: 16px !important;
                    line-height: 1.2 !important;
                    padding: 12px 24px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    white-space: nowrap !important;
                    overflow: visible !important;
                  }
                  #payment-brick-container button span,
                  #payment-brick-container [class*="button"] span {
                    display: inline-block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                  }
                  @media (max-width: 640px) {
                    #payment-brick-container button[type="submit"],
                    #payment-brick-container .mp-checkout-button {
                      width: 100% !important;
                      font-size: 14px !important;
                    }
                  }
                `}</style>
                <div
                  id="payment-brick-container"
                  className="min-h-[400px]"
                >
                  {!brickReady && (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  )}
                </div>

                <p className="text-center text-xs text-slate-500 mt-4">
                  {language === 'pt'
                    ? 'Pagamento seguro processado pelo Mercado Pago'
                    : 'Secure payment processed by Mercado Pago'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

export default function Purchase() {
  return (
    <LanguageProvider>
      <PurchaseContent />
      <WhatsAppButton message="Olá! Preciso de ajuda com minha compra do Limas Finance." />
    </LanguageProvider>
  );
}