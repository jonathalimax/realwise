import React, { useState, useEffect, useRef } from 'react';
import { extractClientId, fetchClientConfig } from '@/config/clientConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2, Lock, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

const CREATE_PAYMENT_URL = import.meta.env.VITE_CREATE_PAYMENT_URL || '';
const PROCESS_PAYMENT_URL = import.meta.env.VITE_PROCESS_PAYMENT_URL || '';
const PARTIAL_LEAD_URL = import.meta.env.VITE_PARTIAL_LEAD_URL || '';

const BASE_PRICE = 479.88;

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export default function CheckoutModal({ open, onClose, section, prefill = {} }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', coupon: '' });
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bricksLoading, setBricksLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(BASE_PRICE);
  const [createPaymentUrl, setCreatePaymentUrl] = useState(CREATE_PAYMENT_URL);
  const [processPaymentUrl, setProcessPaymentUrl] = useState(PROCESS_PAYMENT_URL);
  const [partialLeadUrl, setPartialLeadUrl] = useState(PARTIAL_LEAD_URL);
  const savedPartialRef = useRef(false);
  const bricksControllerRef = useRef(null);
  const bricksMountedRef = useRef(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const processPaymentUrlRef = useRef(processPaymentUrl);
  useEffect(() => { processPaymentUrlRef.current = processPaymentUrl; }, [processPaymentUrl]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const clientId = extractClientId(window.location.pathname) || 'app';
        const config = await fetchClientConfig(clientId);
        if (config.createPaymentUrl) setCreatePaymentUrl(config.createPaymentUrl);
        if (config.processPaymentUrl) setProcessPaymentUrl(config.processPaymentUrl);
        if (config.partialLeadUrl) setPartialLeadUrl(config.partialLeadUrl);
      } catch { /* fallback to env vars */ }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({
        name: prefill.name || '',
        email: prefill.email || '',
        whatsapp: '',
        coupon: prefill.coupon || '',
      });
      setInstallments(1);
      setError('');
      savedPartialRef.current = false;
    } else {
      // Destroy bricks on close
      if (bricksControllerRef.current) {
        bricksControllerRef.current.unmount().catch(() => {});
        bricksControllerRef.current = null;
        bricksMountedRef.current = false;
      }
    }
  }, [open, prefill]);

  // Mount MP Bricks when entering step 2
  useEffect(() => {
    if (step !== 2 || bricksMountedRef.current) return;
    if (!window.MercadoPago) {
      setError('SDK de pagamento não carregado. Recarregue a página.');
      return;
    }

    setBricksLoading(true);

    const mp = new window.MercadoPago(window.__MP_PUBLIC_KEY__, { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();

    const settings = {
      initialization: {
        amount,
        payer: { email: form.email },
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          bankTransfer: 'all',
          atm: 'none',
          maxInstallments: 12,
        },
        visual: {
          style: { theme: 'default' },
          hidePaymentButton: false,
        },
      },
      callbacks: {
        onReady: () => setBricksLoading(false),
        onError: (err) => {
          console.error('[MPBricks] error', err);
          setBricksLoading(false);
        },
        onSubmit: async ({ selectedPaymentMethod, formData }) => {
          setLoading(true);
          setError('');
          try {
            const payload = {
              ...formData,
              installments: formData.installments || installments,
              email: formRef.current.email,
              name: formRef.current.name,
              whatsapp: formRef.current.whatsapp,
              couponCode: formRef.current.coupon.trim().toUpperCase() || undefined,
            };

            const res = await fetch(processPaymentUrlRef.current, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento.');

            if (data.status === 'approved') {
              window.location.href = 'https://realwise.com.br/purchase-success';
            } else if (data.status === 'in_process' || data.status === 'pending') {
              window.location.href = 'https://realwise.com.br/purchase-success?pending=1';
            } else {
              throw new Error(data.status_detail || 'Pagamento não aprovado.');
            }
          } catch (err) {
            setError(err.message || 'Erro inesperado.');
            setLoading(false);
          }
        },
      },
    };

    let cancelled = false;
    bricksBuilder.create('payment', 'mp-bricks-container', settings)
      .then((controller) => {
        if (cancelled) { controller.unmount().catch(() => {}); return; }
        bricksControllerRef.current = controller;
        bricksMountedRef.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[MPBricks] create failed', err);
        setError('Erro ao carregar formulário de pagamento.');
        setBricksLoading(false);
      });
    return () => { cancelled = true; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const { name, email, whatsapp } = form;

    if (!name.trim() || !email.trim() || !whatsapp.trim()) {
      setError('Preencha todos os campos.');
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
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
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

  const inputClass = "w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => handleClose('backdrop')}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 pointer-events-auto max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {step === 2 && (
                    <button
                      onClick={() => {
                        if (bricksControllerRef.current) {
                          bricksControllerRef.current.unmount().catch(() => {});
                          bricksControllerRef.current = null;
                        }
                        bricksMountedRef.current = false;
                        setStep(1);
                      }}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-lg font-bold">
                      {step === 1 ? 'Quase lá!' : 'Pagamento'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {step === 1 ? 'Preencha seus dados para continuar' : `Realwise — Acesso Vitalício · R$${(amount ?? 0).toFixed(2).replace('.', ',')}`}
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

              {/* Step 1 — Contact fields */}
              {step === 1 && (
                <form onSubmit={handleStep1Submit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nome completo</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder="Seu nome" disabled={loading} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">E-mail</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder="voce@exemplo.com" disabled={loading} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">WhatsApp</label>
                    <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder="(11) 99999-9999" disabled={loading} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cupom de desconto <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <input type="text" name="coupon" value={form.coupon} onChange={handleChange} placeholder="BEMVINDO10" disabled={loading} className={`${inputClass} uppercase`} />
                  </div>

                  {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

                  <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]">
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde...</>
                    ) : (
                      <>Continuar para pagamento<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>

                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    Pagamento seguro · Seus dados só seus
                  </p>
                </form>
              )}

              {/* Step 2 — MP Bricks */}
              {step === 2 && (
                <div className="p-6">
                  {bricksLoading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                  )}
                  <div id="mp-bricks-container" className={bricksLoading ? 'hidden' : ''} />
                  {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
                  {loading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando pagamento...
                    </div>
                  )}
                  <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                    Parcelamentos sem juros. Acesso liberado imediatamente após aprovação.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
