import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Shield,
  Heart,
  CreditCard,
  QrCode,
  Copy,
  Loader2,
  Tag,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WhatsAppButton from '@/components/WhatsAppButton';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

function PurchaseContent() {
  const { t, language } = useLanguage();
  const [pricing, setPricing] = useState({ price: 99, discountPercent: 0, discountActive: false });
  const [pix, setPix] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pricingDoc, pixDoc] = await Promise.all([
          getDoc(doc(db, 'cms', 'pricing')),
          getDoc(doc(db, 'cms', 'pix'))
        ]);

        if (pricingDoc.exists()) setPricing(pricingDoc.data());
        if (pixDoc.exists()) setPix(pixDoc.data());
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

  const copyPixKey = () => {
    if (pix?.key) {
      navigator.clipboard.writeText(pix.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Create Mercado Pago payment
  const handleMercadoPagoPayment = async () => {
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

    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          name: name,
          price: finalPrice,
          couponCode: appliedCoupon?.code || null,
        }),
      });

      if (response.status === 404) {
        // API not deployed - show error
        setPaymentError(
          language === 'pt'
            ? 'Serviço indisponível. Use o PIX manual abaixo.'
            : 'Service unavailable. Use manual PIX below.'
        );
        setShowDetails(true);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating payment');
      }

      // Redirect to Mercado Pago checkout
      window.location.href = data.init_point;
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(
        language === 'pt'
          ? 'Erro ao processar. Tente novamente ou use o PIX manual abaixo.'
          : 'Error processing. Try again or use manual PIX below.'
      );
      setShowDetails(true);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Calculate final price
  let basePrice = pricing.price || 99;
  let totalDiscount = 0;

  // Apply pricing discount if active
  if (pricing.discountActive && pricing.discountPercent > 0) {
    const validUntil = pricing.discountEndDate ? new Date(pricing.discountEndDate) : null;
    if (!validUntil || validUntil >= new Date()) {
      totalDiscount += pricing.discountPercent;
    }
  }

  // Apply coupon discount
  if (appliedCoupon) {
    totalDiscount += appliedCoupon.discountPercent;
  }

  // Cap discount at 100%
  totalDiscount = Math.min(totalDiscount, 100);

  const finalPrice = basePrice * (1 - totalDiscount / 100);

  const features = [
    language === 'pt' ? 'Acesso completo ao sistema web e mobile' : 'Full access to web and mobile app',
    language === 'pt' ? 'Transações e contas ilimitadas' : 'Unlimited transactions & accounts',
    language === 'pt' ? 'Todos os recursos atuais e futuros' : 'All current and future features',
    language === 'pt' ? 'Atualizações vitalícias incluídas' : 'Lifetime updates included',
    language === 'pt' ? 'Suporte prioritário' : 'Priority support',
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{language === 'pt' ? 'Voltar' : 'Back'}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold hidden sm:block">Limas Finance</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 mb-4 sm:mb-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
              <Heart className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {language === 'pt' ? '50% vão para a igreja' : '50% goes to the church'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
              {language === 'pt' ? 'Finalizar Compra' : 'Complete Purchase'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {language === 'pt' ? 'Acesso vitalício ao Limas Finance' : 'Lifetime access to Limas Finance'}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
            {/* Left: Product Summary */}
            <div className="space-y-4 sm:space-y-6">
              {/* Product Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  {language === 'pt' ? 'Acesso Completo' : 'Complete Access'}
                </h2>

                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                      <Check className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {language === 'pt' ? 'Ver mais detalhes' : 'See more details'}
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
                        ? '• Um sistema por pessoa. Seus dados armazenados na sua própria conta.'
                        : '• One system per person. Your data stored in your own account.'}
                    </p>
                    <p>
                      {language === 'pt'
                        ? '• Sem taxas de hospedagem ou domínio.'
                        : '• No hosting or domain fees.'}
                    </p>
                    <p>
                      {language === 'pt'
                        ? '• Garantia de reembolso de 30 dias.'
                        : '• 30-day money-back guarantee.'}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Security Badge */}
              <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Shield className="w-6 h-6 text-emerald-500" />
                <div>
                  <p className="font-medium text-sm">
                    {language === 'pt' ? 'Compra Segura' : 'Secure Purchase'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'pt' ? 'Seus dados estão protegidos' : 'Your data is protected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Payment */}
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
                    <span>- R$ {(basePrice - finalPrice).toFixed(2)}</span>
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

              {/* Payment Method */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium mb-2 sm:mb-3">
                  {language === 'pt' ? 'Método de pagamento' : 'Payment method'}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                      paymentMethod === 'pix'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <QrCode className="w-4 sm:w-5 h-4 sm:h-5" />
                    PIX
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                      paymentMethod === 'card'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <CreditCard className="w-4 sm:w-5 h-4 sm:h-5" />
                    {language === 'pt' ? 'Cartão' : 'Card'}
                  </button>
                </div>
              </div>

              {/* PIX Payment */}
              {paymentMethod === 'pix' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Email input for automatic PIX */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {language === 'pt' ? 'Seu nome' : 'Your name'}
                      </label>
                      <Input
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
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                      <p className="text-sm text-rose-600 dark:text-rose-400">{paymentError}</p>
                    </div>
                  )}

                  {/* Mercado Pago button */}
                  <Button
                    onClick={handleMercadoPagoPayment}
                    disabled={paymentLoading || !email}
                    className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-[#009ee3] hover:bg-[#008dd0] text-white"
                  >
                    {paymentLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <QrCode className="w-5 h-5 mr-2" />
                    )}
                    {language === 'pt' ? 'Pagar com PIX' : 'Pay with PIX'}
                  </Button>

                  <p className="text-center text-xs text-slate-500">
                    {language === 'pt'
                      ? 'Você será redirecionado para o Mercado Pago para concluir o pagamento.'
                      : 'You will be redirected to Mercado Pago to complete payment.'}
                  </p>

                  {/* Manual PIX fallback */}
                  {pix?.key && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex items-center justify-center gap-2 w-full text-sm text-slate-500 hover:text-slate-700"
                      >
                        {language === 'pt' ? 'Ou pague manualmente' : 'Or pay manually'}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                      </button>

                      {showDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 space-y-4"
                        >
                          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              {language === 'pt'
                                ? `Transfira R$ ${finalPrice.toFixed(2)} via PIX para:`
                                : `Transfer R$ ${finalPrice.toFixed(2)} via PIX to:`}
                            </p>
                            {pix.beneficiary && (
                              <p className="font-semibold mb-3">{pix.beneficiary}</p>
                            )}

                            {pix.qrCodeUrl && (
                              <div className="flex justify-center mb-4">
                                <img src={pix.qrCodeUrl} alt="QR Code PIX" className="w-40 h-40 rounded-lg" />
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 font-mono text-xs truncate border border-slate-200 dark:border-slate-700">
                                {pix.key}
                              </div>
                              <Button
                                onClick={copyPixKey}
                                variant={copied ? "emerald" : "outline"}
                                size="sm"
                                className="rounded-lg"
                              >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              {language === 'pt'
                                ? 'Após o pagamento, envie o comprovante pelo WhatsApp para liberarmos seu acesso em até 24h.'
                                : 'After payment, send the receipt via WhatsApp and we\'ll grant access within 24h.'}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Card Payment */}
              {paymentMethod === 'card' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-xl text-center">
                    <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      {language === 'pt'
                        ? 'Pagamento com cartão em breve. Por enquanto, use PIX ou entre em contato pelo WhatsApp.'
                        : 'Card payment coming soon. For now, use PIX or contact us via WhatsApp.'}
                    </p>
                    <Button
                      onClick={() => setPaymentMethod('pix')}
                      variant="outline"
                      className="rounded-xl"
                    >
                      {language === 'pt' ? 'Usar PIX' : 'Use PIX'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function Purchase() {
  return (
    <LanguageProvider>
      <PurchaseContent />
      <WhatsAppButton message="Olá! Acabei de fazer um pagamento PIX para o Limas Finance e gostaria de confirmar." />
    </LanguageProvider>
  );
}
