# Mercado Pago Primary Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stripe Checkout with Mercado Pago Bricks as the primary payment flow, enabling Pix, Boleto, and credit card installments (2x–12x sem juros) embedded directly in the CheckoutModal.

**Architecture:** The CheckoutModal gains a Step 2 that renders MP Bricks (vanilla JS SDK) inline. `createPayment` is updated to validate coupons, upsert the lead, and return `{ publicKey, amount }`. `processPayment` increments coupon uses on approval. The abandoned checkout email URL is updated to open the modal flow. Stripe is kept only for admin discount links.

**Tech Stack:** Mercado Pago JS SDK (vanilla, loaded via script tag), Firebase Cloud Functions v1 Node.js 20, React 19, Tailwind CSS v4

**Branch:** `feat/mercadopago-primary-checkout`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `landing_page/components/landing/CheckoutModal.jsx` | Modify | Add Step 2 with MP Bricks, installment selector, coupon field |
| `functions/index.js` → `createPayment` | Modify | Add coupon validation, lead upsert, landing_stats increment, return `amount` |
| `functions/index.js` → `processPayment` | Modify | Increment `coupon.currentUses` on approval |
| `functions/index.js` → `grantAccessAndNotify` | Modify | Pass `installments` and `couponCode` to purchase record |
| `functions/emailTemplates.js` → `buildCheckoutUrl` | Modify | Point at landing page `/?checkout=1&email=...&coupon=...` |
| `src/pages/CheckoutRedirect.jsx` | Keep | Fallback only, no changes needed |

---

## Task 1: Install MP JS SDK via script tag in landing page HTML

**Files:**
- Modify: `index.html` (root, the one used by Vite for the landing page build)

- [ ] **Step 1: Find the correct index.html**

```bash
find /Users/jonathalima/Developer/personal/limas-finance -name "index.html" -not -path "*/node_modules/*" -not -path "*/dist/*"
```

- [ ] **Step 2: Add MP SDK script tag before closing `</head>`**

In whichever `index.html` serves the landing page, add:

```html
<script src="https://sdk.mercadopago.com/js/v2"></script>
```

Place it just before `</head>`. This loads `window.MercadoPago` globally.

- [ ] **Step 3: Verify build still works**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: load Mercado Pago JS SDK v2 via script tag"
```

---

## Task 2: Update `createPayment` — coupon validation, lead upsert, return amount

**Files:**
- Modify: `functions/index.js` lines ~145–182

The current `createPayment` only saves a `pending_payments` doc and returns `publicKey`. We need it to also: validate the coupon, compute discounted amount, upsert the lead, increment `landing_stats`, and return `{ publicKey, amount }`.

- [ ] **Step 1: Replace the `createPayment` export in `functions/index.js`**

Find the existing `exports.createPayment` block (lines ~145–182) and replace it entirely with:

```js
exports.createPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { email, name, whatsapp, couponCode, utmSource } = req.body;

      if (!email) {
        res.status(400).json({ error: 'email é obrigatório.' });
        return;
      }

      const publicKey = functions.config().mercadopago?.public_key;
      if (!publicKey) {
        res.status(500).json({ error: 'Configuração de pagamento ausente.' });
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const BASE_AMOUNT = 479.88;
      let amount = BASE_AMOUNT;

      // Validate coupon if provided
      if (couponCode) {
        const snap = await db.collection('coupons')
          .where('code', '==', couponCode.toUpperCase())
          .limit(1)
          .get();

        if (snap.empty) {
          res.status(400).json({ error: 'Cupom não encontrado.' });
          return;
        }

        const cd = snap.docs[0].data();
        const now = new Date();

        if (!cd.enabled) {
          res.status(400).json({ error: 'Cupom desabilitado.' });
          return;
        }
        if (cd.maxUses !== null && cd.maxUses !== undefined && (cd.currentUses || 0) >= cd.maxUses) {
          res.status(400).json({ error: 'Cupom atingiu o limite de usos.' });
          return;
        }
        if (cd.validUntil && cd.validUntil.toDate() < now) {
          res.status(400).json({ error: 'Cupom expirado.' });
          return;
        }
        if (cd.validFrom && cd.validFrom.toDate() > now) {
          res.status(400).json({ error: 'Cupom ainda não é válido.' });
          return;
        }

        if (cd.discountType === 'percentage') {
          amount = parseFloat((BASE_AMOUNT * (1 - cd.discountValue / 100)).toFixed(2));
        } else {
          // fixed_amount: discountValue stored in centavos
          amount = parseFloat((BASE_AMOUNT - cd.discountValue / 100).toFixed(2));
        }
      }

      // Upsert lead
      const leadRef = db.collection('leads').doc(emailLower);
      const leadSnap = await leadRef.get();
      const isNew = !leadSnap.exists;
      await leadRef.set(
        {
          name: name ? name.trim() : (leadSnap.data()?.name ?? ''),
          email: emailLower,
          ...(whatsapp ? { whatsapp: whatsapp.trim() } : {}),
          paid: false,
          state: leadSnap.data()?.state ?? 'checkout_started',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(isNew && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );

      // Increment landing_stats
      const today = new Date().toISOString().slice(0, 10);
      const source = (utmSource && typeof utmSource === 'string') ? utmSource : 'direct';
      db.collection('landing_stats').doc(today).set(
        {
          checkout_started: admin.firestore.FieldValue.increment(1),
          [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      ).catch(err => console.error('[createPayment] landing_stats failed:', err));

      // Save pending payment
      await db.collection('pending_payments').add({
        email: emailLower,
        name: name || '',
        amount,
        couponCode: couponCode || null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ publicKey, amount });
    } catch (error) {
      console.error('[createPayment] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add functions/index.js
git commit -m "feat: update createPayment with coupon validation, lead upsert, return amount"
```

---

## Task 3: Update `processPayment` — increment coupon uses on approval

**Files:**
- Modify: `functions/index.js` → `processPayment` (lines ~187–268)

After a successful payment (`response.status === 'approved'`), increment `coupon.currentUses` if a coupon was used.

- [ ] **Step 1: Find the approval block in `processPayment`**

Locate this block inside `processPayment`:

```js
// If approved, grant access and send email
if (response.status === 'approved') {
  await grantAccessAndNotify((payer?.email || email).toLowerCase(), name, couponCode);
}
```

- [ ] **Step 2: Add coupon increment after grant**

Replace that block with:

```js
if (response.status === 'approved') {
  const approvedEmail = (payer?.email || email).toLowerCase();
  await grantAccessAndNotify(approvedEmail, name, couponCode, parseInt(installments) || 1);

  // Increment coupon uses
  if (couponCode) {
    const couponSnap = await db.collection('coupons')
      .where('code', '==', couponCode.toUpperCase())
      .limit(1)
      .get();
    if (!couponSnap.empty) {
      await couponSnap.docs[0].ref.update({
        currentUses: admin.firestore.FieldValue.increment(1),
      });
    }
  }
}
```

- [ ] **Step 3: Update `grantAccessAndNotify` signature to accept installments**

Find the `grantAccessAndNotify` function definition (~line 271) and update its signature and purchase doc:

```js
async function grantAccessAndNotify(email, name, couponCode, installments = 1) {
  try {
    await db.collection('purchases').add({
      email: email.toLowerCase(),
      name: name || '',
      couponCode: couponCode || null,
      installments,
      purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // ... rest unchanged
```

- [ ] **Step 4: Commit**

```bash
git add functions/index.js
git commit -m "feat: increment coupon uses on MP payment approval, track installments in purchase"
```

---

## Task 4: Update `buildCheckoutUrl` in `emailTemplates.js`

**Files:**
- Modify: `functions/emailTemplates.js` lines 12–20

The abandoned checkout email links currently go to `/checkout` (Stripe `CheckoutRedirect`). Update to open the landing page with checkout modal pre-filled.

- [ ] **Step 1: Replace `buildCheckoutUrl`**

```js
function buildCheckoutUrl({ email, name, couponCode } = {}) {
  const base = 'https://realwise.com.br';
  const params = new URLSearchParams();
  params.set('checkout', '1');
  if (email) params.set('email', email);
  if (name) params.set('name', name);
  if (couponCode) params.set('coupon', couponCode);
  return `${base}/?${params.toString()}`;
}
exports.buildCheckoutUrl = buildCheckoutUrl;
```

- [ ] **Step 2: Commit**

```bash
git add functions/emailTemplates.js
git commit -m "feat: update buildCheckoutUrl to open MP modal flow on landing page"
```

---

## Task 5: Handle `?checkout=1` URL param in landing page to auto-open modal

**Files:**
- Modify: `landing_page/pages/index.jsx` (or whichever file is the landing page root — find with `find landing_page -name "*.jsx" | xargs grep -l "CheckoutModal" | head -3`)

- [ ] **Step 1: Find landing page root**

```bash
find /Users/jonathalima/Developer/personal/limas-finance/landing_page -name "*.jsx" | xargs grep -l "CheckoutModal" 2>/dev/null
```

- [ ] **Step 2: Read the file and locate where `CheckoutModal` is opened**

Find the state that controls `CheckoutModal`'s `open` prop (e.g., `const [checkoutOpen, setCheckoutOpen] = useState(false)`).

- [ ] **Step 3: Add URL param auto-open on mount**

Add a `useEffect` that reads `?checkout=1` and pre-fills email/coupon:

```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === '1') {
    const email = params.get('email') || '';
    const coupon = params.get('coupon') || '';
    const name = params.get('name') || '';
    setCheckoutOpen(true);
    if (email || coupon || name) {
      setCheckoutPrefill({ email, coupon, name });
    }
  }
}, []);
```

Add `checkoutPrefill` state: `const [checkoutPrefill, setCheckoutPrefill] = useState({})`.

Pass it to `CheckoutModal`: `<CheckoutModal ... prefill={checkoutPrefill} />`.

- [ ] **Step 4: Commit**

```bash
git add landing_page/pages/
git commit -m "feat: auto-open checkout modal on ?checkout=1 URL param"
```

---

## Task 6: Update `CheckoutModal` — add Step 2 with MP Bricks

**Files:**
- Modify: `landing_page/components/landing/CheckoutModal.jsx`

This is the main task. The modal becomes a 2-step flow:
- Step 1: contact fields (existing)
- Step 2: MP Bricks payment form (new)

- [ ] **Step 1: Replace `CheckoutModal.jsx` entirely**

```jsx
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
const INSTALLMENT_OPTIONS = [
  { value: 1,  label: '1x de R$479,88 (à vista)' },
  { value: 2,  label: '2x de R$239,94 sem juros' },
  { value: 3,  label: '3x de R$159,96 sem juros' },
  { value: 6,  label: '6x de R$79,98 sem juros'  },
  { value: 12, label: '12x de R$39,99 sem juros' },
];

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
          ticket: 'all',   // boleto
          bankTransfer: 'all', // pix
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
              email: form.email,
              name: form.name,
              whatsapp: form.whatsapp,
              couponCode: form.coupon.trim().toUpperCase() || undefined,
            };

            const res = await fetch(processPaymentUrl, {
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

    bricksBuilder.create('payment', 'mp-bricks-container', settings)
      .then((controller) => {
        bricksControllerRef.current = controller;
        bricksMountedRef.current = true;
      })
      .catch((err) => {
        console.error('[MPBricks] create failed', err);
        setError('Erro ao carregar formulário de pagamento.');
        setBricksLoading(false);
      });
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

      // Store public key globally for Bricks
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
                      onClick={() => { setStep(1); bricksMountedRef.current = false; }}
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
                      {step === 1 ? 'Preencha seus dados para continuar' : `Realwise — Acesso Vitalício · R$${amount.toFixed(2).replace('.', ',')}`}
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
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -8
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/CheckoutModal.jsx
git commit -m "feat: add MP Bricks payment step to CheckoutModal with installment support"
```

---

## Task 7: Add env vars for new MP endpoints

**Files:**
- Modify: `.env` (dev env vars — MP functions already deployed)

- [ ] **Step 1: Check existing env vars**

```bash
grep "VITE_" /Users/jonathalima/Developer/personal/limas-finance/.env 2>/dev/null | head -20
```

- [ ] **Step 2: Add MP URLs if not present**

Add to `.env`:

```
VITE_CREATE_PAYMENT_URL=https://us-central1-moneywise-ad9ec.cloudfunctions.net/createPayment
VITE_PROCESS_PAYMENT_URL=https://us-central1-moneywise-ad9ec.cloudfunctions.net/processPayment
```

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "chore: add MP payment function URLs to env vars"
```

---

## Task 8: Deploy functions and hosting

- [ ] **Step 1: Deploy updated functions**

```bash
firebase deploy --only functions:createPayment,functions:processPayment,functions:mercadoPagoWebhook
```

Expected: all 3 functions update successfully.

- [ ] **Step 2: Build frontend**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Deploy hosting**

```bash
firebase deploy --only hosting
```

- [ ] **Step 4: Smoke test**

Open `https://realwise.com.br` → click purchase CTA → fill Step 1 → verify MP Bricks renders in Step 2 with card/Pix/Boleto tabs visible.

- [ ] **Step 5: Test coupon**

Open `https://realwise.com.br/?checkout=1&email=test@test.com&coupon=GLASER5` → verify modal opens pre-filled and coupon is applied (amount changes from R$479,88).

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: deploy MP primary checkout — Pix, Boleto, installments live"
```

---

## Task 9: Update "Pagamento seguro via Stripe" label

The modal footer currently says "Pagamento seguro via Stripe". This was already replaced in Task 6, but verify no other references remain.

- [ ] **Step 1: Check for remaining Stripe references in landing page**

```bash
grep -rn "Stripe\|stripe" /Users/jonathalima/Developer/personal/limas-finance/landing_page --include="*.jsx" --include="*.js"
```

- [ ] **Step 2: Fix any remaining references**

Replace any "via Stripe" text with "via Mercado Pago" or remove payment processor branding.

- [ ] **Step 3: Commit if changed**

```bash
git add landing_page/
git commit -m "chore: remove Stripe branding from landing page"
```
