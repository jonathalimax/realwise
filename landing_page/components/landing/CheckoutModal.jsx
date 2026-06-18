import React, { useState, useEffect, useRef } from 'react';
import { extractClientId, fetchClientConfig } from '@/config/clientConfig';
import { ArrowRight, Loader2, Lock, ChevronLeft, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const CREATE_PAYMENT_URL = import.meta.env.VITE_CREATE_PAYMENT_URL || '';
const PROCESS_PAYMENT_URL = import.meta.env.VITE_PROCESS_PAYMENT_URL || '';
const PARTIAL_LEAD_URL = import.meta.env.VITE_PARTIAL_LEAD_URL || '';

// BASE_PRICE / PROMO_PRICE are seeded from Firestore on mount; these are
// only the pre-fetch fallback shown for an instant before config/pricing loads.
const FALLBACK_BASE_PRICE = 479;
const FALLBACK_PROMO_PRICE = 239;

const MP_STATUS_MESSAGES = {
  cc_rejected_insufficient_amount:      'Saldo insuficiente. Verifique o limite do seu cartão.',
  cc_rejected_bad_filled_security_code: 'Código de segurança inválido. Verifique o CVV.',
  cc_rejected_bad_filled_date:          'Data de vencimento inválida. Verifique os dados do cartão.',
  cc_rejected_bad_filled_other:         'Dados do cartão incorretos. Verifique e tente novamente.',
  cc_rejected_call_for_authorize:       'Ligue para o banco para autorizar o pagamento e tente novamente.',
  cc_rejected_card_disabled:            'Cartão desativado. Entre em contato com o banco.',
  cc_rejected_card_error:               'Erro no cartão. Tente outro cartão ou use Pix.',
  cc_rejected_duplicated_payment:       'Pagamento duplicado detectado. Aguarde alguns minutos.',
  cc_rejected_high_risk:                'Pagamento recusado por segurança. Tente outro cartão ou use Pix.',
  cc_rejected_max_attempts:             'Muitas tentativas. Use outro cartão ou tente mais tarde.',
  cc_rejected_other_reason:             'Cartão recusado. Tente outro cartão ou use Pix.',
};

function mpErrorMessage(statusDetail) {
  if (!statusDetail) return null;
  return MP_STATUS_MESSAGES[statusDetail] || null;
}

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export default function CheckoutModal({ open, onClose, prefill = {} }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', coupon: '' });
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bricksLoading, setBricksLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(FALLBACK_PROMO_PRICE);
  const [basePrice, setBasePrice] = useState(FALLBACK_BASE_PRICE);
  const [promoPrice, setPromoPrice] = useState(FALLBACK_PROMO_PRICE);
  const [createPaymentUrl, setCreatePaymentUrl] = useState(CREATE_PAYMENT_URL);
  const [processPaymentUrl, setProcessPaymentUrl] = useState(PROCESS_PAYMENT_URL);
  const [partialLeadUrl, setPartialLeadUrl] = useState(PARTIAL_LEAD_URL);
  const autoSubmittedRef = useRef(false);
  const savedPartialRef = useRef(false);
  const bricksControllerRef = useRef(null);
  const bricksMountedRef = useRef(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const amountRef = useRef(amount);
  useEffect(() => { amountRef.current = amount; }, [amount]);
  const processPaymentUrlRef = useRef(processPaymentUrl);
  useEffect(() => { processPaymentUrlRef.current = processPaymentUrl; }, [processPaymentUrl]);

  // Mount/unmount with CSS transition
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two rAFs ensure the element is painted before the transition starts
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const hostname = window.location.hostname;
        const rawId = extractClientId(hostname);
        const clientId = rawId === 'realwise-dev' ? 'app.dev' : (rawId || 'app');
        const config = await fetchClientConfig(clientId);
        if (config.createPaymentUrl) setCreatePaymentUrl(config.createPaymentUrl);
        if (config.processPaymentUrl) setProcessPaymentUrl(config.processPaymentUrl);
        if (config.partialLeadUrl) setPartialLeadUrl(config.partialLeadUrl);
      } catch { /* fallback to env vars */ }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'config', 'pricing')).then((snap) => {
      const data = snap.data();
      if (data && data.active) {
        setBasePrice(data.originalCents / 100);
        setPromoPrice(data.totalCents / 100);
      }
    }).catch(() => { /* keep fallback */ });
  }, []);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({
        name: prefill.name || '',
        email: prefill.email || '',
        whatsapp: prefill.whatsapp || '',
        coupon: prefill.coupon || '',
      });
      setInstallments(1);
      setError('');
      setAmount(promoPrice);
      savedPartialRef.current = false;
    } else {
      destroyBricks();
    }
  }, [open, prefill, promoPrice]);

  // Auto-submit step 1 when all contact fields are pre-filled and config URL is ready
  useEffect(() => {
    if (!open) { autoSubmittedRef.current = false; return; }
    if (step !== 1 || autoSubmittedRef.current) return;
    if (!createPaymentUrl) return; // wait for config to load
    const { name, email, whatsapp, coupon } = prefill;
    if (!name || !email || !whatsapp) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    autoSubmittedRef.current = true;
    landingAnalytics.trackFormSubmitted();
    setLoading(true);
    setError('');
    fetch(createPaymentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        couponCode: coupon?.trim().toUpperCase() || undefined,
        utmSource: landingAnalytics.getUtmSource(),
      }),
    })
      .then(res => res.json().then(data => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento.');
        window.__MP_PUBLIC_KEY__ = data.publicKey;
        setAmount(data.amount);
        setLoading(false);
        setStep(2);
      })
      .catch(err => {
        setError(err.message || 'Erro inesperado. Tente novamente.');
        setLoading(false);
      });
  }, [open, createPaymentUrl, basePrice, promoPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  function destroyBricks() {
    if (bricksControllerRef.current) {
      try { bricksControllerRef.current.unmount(); } catch { /* ignore */ }
      bricksControllerRef.current = null;
    }
    bricksMountedRef.current = false;
  }

  // Mount MP Bricks when entering step 2
  useEffect(() => {
    if (step !== 2 || bricksMountedRef.current) return;
    if (amountRef.current === 0) return; // free order — skip bricks
    if (!window.MercadoPago) {
      setError('SDK de pagamento não carregado. Recarregue a página.');
      return;
    }

    setBricksLoading(true);

    const mp = new window.MercadoPago(window.__MP_PUBLIC_KEY__, { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const settings = {
      initialization: {
        amount,
        payer: { email: form.email },
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          ticket: 'all',
          bankTransfer: 'all',
          maxInstallments: 12,
        },
        visual: {
          style: {
            theme: prefersDark ? 'dark' : 'default',
            customVariables: prefersDark ? {
              textPrimaryColor: '#f1f5f9',
              textSecondaryColor: '#94a3b8',
              inputBackgroundColor: '#1e293b',
              formBackgroundColor: '#0f172a',
              baseColor: '#7c3aed',
              baseColorFirstVariant: '#6d28d9',
              baseColorSecondVariant: '#5b21b6',
              errorColor: '#f87171',
            } : {
              baseColor: '#7c3aed',
              baseColorFirstVariant: '#6d28d9',
              baseColorSecondVariant: '#5b21b6',
            },
          },
          hidePaymentButton: false,
        },
      },
      callbacks: {
        onReady: () => setBricksLoading(false),
        onError: (err) => {
          if (err?.type === 'non_critical') return;
          console.error('[MPBricks] error', err);
          setBricksLoading(false);
          setError('Erro ao carregar pagamento. Tente novamente.');
        },
        onSubmit: async ({ formData }) => {
          setLoading(true);
          setError('');

          let res, data;
          try {
            res = await fetch(processPaymentUrlRef.current, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...formData,
                transaction_amount: formData.transaction_amount ?? amountRef.current,
                installments: formData.installments || installments,
                email: formRef.current.email,
                name: formRef.current.name,
                whatsapp: formRef.current.whatsapp,
                couponCode: formRef.current.coupon.trim().toUpperCase() || undefined,
              }),
            });
            data = await res.json().catch(() => ({}));
          } catch {
            setError('__WPP__');
            setLoading(false);
            throw new Error('network_error');
          }

          if (!res.ok) {
            setError('__WPP__');
            setLoading(false);
            throw new Error('server_error');
          }

          const baseUrl = window.location.origin;
          if (data.status === 'approved') {
            window.location.href = `${baseUrl}/purchase-success`;
          } else if (data.status === 'in_process' || data.status === 'pending') {
            if (data.pix_code) sessionStorage.setItem('pix_code', data.pix_code);
            if (data.pix_qr_base64) sessionStorage.setItem('pix_qr_base64', data.pix_qr_base64);
            if (data.pending_doc_id) sessionStorage.setItem('pix_doc_id', data.pending_doc_id);
            sessionStorage.setItem('pix_email', formRef.current.email);
            sessionStorage.setItem('pending_type', data.pix_code ? 'pix' : 'card');
            window.location.href = `${baseUrl}/purchase-success?pending=1`;
          } else {
            setError(mpErrorMessage(data.status_detail) || '__WPP__');
            setLoading(false);
            throw new Error(data.status_detail || 'rejected');
          }
        },
      },
    };

    let cancelled = false;
    bricksBuilder.create('payment', 'mp-bricks-container', settings)
      .then((controller) => {
        if (cancelled) { try { controller.unmount(); } catch { /* ignore */ } return; }
        bricksControllerRef.current = controller;
        bricksMountedRef.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[MPBricks] create failed', err);
        setError('Erro ao carregar formulário de pagamento.');
        setBricksLoading(false);
      });

    return () => {
      cancelled = true;
      destroyBricks();
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFreeCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(processPaymentUrlRef.current, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_amount: 0,
          email: formRef.current.email,
          name: formRef.current.name,
          whatsapp: formRef.current.whatsapp,
          couponCode: formRef.current.coupon.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao processar acesso.');
      if (data.status === 'approved') {
        const baseUrl = window.location.origin;
        window.location.href = `${baseUrl}/purchase-success`;
      } else {
        throw new Error('Não foi possível ativar o acesso. Tente novamente.');
      }
    } catch (err) {
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const formatted = name === 'whatsapp' ? maskPhone(value) : value;
    setForm((prev) => ({ ...prev, [name]: formatted }));
    setError('');
  };

  function handleFocus(e) { landingAnalytics.trackFieldFocused(e.target.name); }

  function handleBlur(e) {
    const { name, value } = e.target;
    if (!value.trim()) return;
    landingAnalytics.trackFieldCompleted(name);
    if (name === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !savedPartialRef.current) {
      savedPartialRef.current = true;
      savePartialLead({ email: value.trim().toLowerCase(), name: form.name.trim() || undefined });
    }
    if (name === 'whatsapp' && savedPartialRef.current) {
      const email = form.email.trim().toLowerCase();
      if (email) savePartialLead({ email, whatsapp: value.trim() });
    }
  }

  async function savePartialLead(payload) {
    if (!partialLeadUrl) return;
    try {
      await fetch(partialLeadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, utmSource: landingAnalytics.getUtmSource() }),
      });
    } catch { /* never throw */ }
  }

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    const { email } = form;

    if (!email.trim()) {
      setError('Preencha o e-mail.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido.');
      return;
    }

    landingAnalytics.trackFormSubmitted();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          couponCode: form.coupon.trim().toUpperCase() || undefined,
          utmSource: landingAnalytics.getUtmSource(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento.');

      window.__MP_PUBLIC_KEY__ = data.publicKey;
      setAmount(data.amount);
      setLoading(false);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  function handleClose(reason) {
    onClose(reason, [form.name, form.email, form.whatsapp].filter(Boolean).length);
  }

  const inputClass = "w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition";

  const displayAmount = amount ?? promoPrice;
  const hasCouponDiscount = step === 2 && displayAmount < promoPrice;
  const fmt = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const couponLabel = form.coupon?.trim().toUpperCase();

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={() => handleClose('backdrop')}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Sheet — slides up from bottom on mobile, centered modal on md+ */}
      <div className="absolute inset-0 flex items-end justify-center md:items-center pointer-events-none">
        <div
          className={`
            pointer-events-auto w-full md:max-w-md
            bg-white dark:bg-slate-900
            rounded-t-3xl md:rounded-2xl
            shadow-2xl border border-slate-200 dark:border-slate-700
            max-h-[92dvh] md:max-h-[90vh] flex flex-col
            transition-transform duration-300 ease-out
            ${visible ? 'translate-y-0' : 'translate-y-full md:translate-y-4'}
          `}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  onClick={() => {
                    destroyBricks();
                    setError('');
                    setLoading(false);
                    setStep(1);
                  }}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {step === 1 ? 'Quase lá!' : 'Pagamento seguro'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {step === 1 ? 'Preencha seus dados para continuar' : 'Pagamento único · acesso vitalício'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleClose('button')}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Price badge */}
            <div className="px-6 pt-4">
              <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 px-5 py-3 flex items-center gap-3">
                {hasCouponDiscount ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-through leading-none">{fmt(basePrice)}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-through leading-none">{fmt(promoPrice)}</p>
                      <p className="text-2xl font-extrabold text-violet-700 dark:text-violet-300 leading-tight">{fmt(displayAmount)}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">50% OFF</span>
                      <span className="text-xs font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">{couponLabel}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-through leading-none">{fmt(basePrice)}</p>
                      <p className="text-2xl font-extrabold text-violet-700 dark:text-violet-300 leading-tight">{fmt(promoPrice)}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">50% OFF</span>
                      {couponLabel && (
                        <span className="text-xs font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">+ {couponLabel}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Step 1 — Contact fields */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="px-6 pt-4 pb-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">E-mail</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder="voce@exemplo.com" disabled={loading} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Cupom de desconto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input type="text" name="coupon" value={form.coupon} onChange={handleChange} placeholder="BEMVINDO10" disabled={loading} className={`${inputClass} uppercase`} />
                </div>

                {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

                <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-all duration-200 active:scale-95">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde...</>
                  ) : (
                    <>Continuar para pagamento<ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                <p className="text-xs text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5 pb-2">
                  <Lock className="w-3 h-3" />
                  Pagamento seguro · Seus dados só seus
                </p>
              </form>
            )}

            {/* Step 2 — MP Bricks or free checkout */}
            {step === 2 && (
              <div className="px-6 pt-4 pb-5">
                {amount === 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                      Seu cupom cobre 100% do valor. Clique para ativar seu acesso gratuito.
                    </p>
                    <Button
                      onClick={handleFreeCheckout}
                      disabled={loading}
                      className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-all duration-200 active:scale-95"
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde...</>
                      ) : (
                        <>Ativar acesso gratuito<ArrowRight className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                    {bricksLoading && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                      </div>
                    )}
                    <div id="mp-bricks-container" className={bricksLoading ? 'hidden' : ''} />
                  </>
                )}
                {error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 dark:text-rose-300 leading-snug">
                      {error === '__WPP__' ? (
                        <>
                          Problema no pagamento.{' '}
                          <a
                            href="https://wa.me/5541992310339?text=Tive+um+problema+no+checkout+do+Realwise"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-medium"
                          >
                            Fale conosco no WhatsApp
                          </a>
                          {' '}e te ajudamos.
                        </>
                      ) : error}
                    </p>
                  </div>
                )}
                {loading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando pagamento...
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
