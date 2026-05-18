# Analytics & Conversion Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full GA4 event tracking, UTM short links, partial lead capture on checkout abandon, and a funnel panel in the Admin dashboard.

**Architecture:** A single `landingAnalytics.js` module wraps all gtag calls and reads UTM params once at page load. Firebase Hosting static redirects handle short links at CDN level. A new `savePartialLead` Cloud Function upserts the existing `leads` collection on email blur and increments daily `landing_stats` counters. The Admin LeadsDashboard gets a funnel panel reading those counters.

**Tech Stack:** React 19, Vite, Firebase Hosting, Firebase Functions (Node 20), Firestore, GA4 / gtag.js

---

## Prerequisites

- You need a GA4 Measurement ID (format: `G-XXXXXXXXXX`). Get it from your GA4 property → Admin → Data Streams → Web stream. Set it as `VITE_GA_MEASUREMENT_ID` in your `.env` file for local dev, and note the raw value — it's hard-coded in the landing page (no Vite env at runtime for the landing page HTML injection).
- Identify which Firebase Hosting site ID serves `realwise.com.br` (it's one of: `moneywise-ad9ec`, `mymoneywise`). This is where the `/go/*` redirects go.

---

## File Map

| File | Action |
|---|---|
| `firebase.json` | Add `/go/*` redirect rules to the realwise.com.br hosting site |
| `landing_page/landingAnalytics.js` | **Create** — all tracking functions |
| `landing_page/pages/home.jsx` | Add GA4 script tag, call `landingAnalytics.init()`, pass `section` to `onBuy` |
| `landing_page/components/landing/HeroSection.jsx` | Add `data-section="hero"`, call `trackCtaClicked` |
| `landing_page/components/landing/PainPointsSection.jsx` | Add `data-section="pain-points"` |
| `landing_page/components/landing/FeaturesSection.jsx` | Add `data-section="features"` |
| `landing_page/components/landing/DataOwnershipSection.jsx` | Add `data-section="data-ownership"` |
| `landing_page/components/landing/WhyRealwiseSection.jsx` | Add `data-section="why-realwise"` |
| `landing_page/components/landing/PricingSection.jsx` | Add `data-section="pricing"`, call `trackCtaClicked` |
| `landing_page/components/landing/FinalCTASection.jsx` | Add `data-section="final-cta"`, call `trackCtaClicked` |
| `landing_page/components/landing/CheckoutModal.jsx` | Add field blur handlers, call all checkout tracking functions |
| `functions/savePartialLead.js` | **Create** — upserts partial lead + increments `landing_stats` |
| `functions/createCheckoutSession.js` | Add `landing_stats` increment on checkout start |
| `functions/index.js` | Export `savePartialLead`; add `form_partial` guard to `onNewLead` |
| `src/pages/admin/LeadsDashboard.jsx` | Add funnel panel reading `landing_stats` last 7 days |

---

## Task 1: UTM Short Link Redirects in firebase.json

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: Add redirect rules**

Open `firebase.json`. Find the hosting entry that serves `realwise.com.br` (check your Firebase console if unsure which `site` ID it is). Add a `"redirects"` array **before** the `"rewrites"` array in that site object:

```json
"redirects": [
  {
    "source": "/go/whatsapp",
    "destination": "/?utm_source=whatsapp&utm_medium=social&utm_campaign=launch",
    "type": 301
  },
  {
    "source": "/go/instagram",
    "destination": "/?utm_source=instagram&utm_medium=social&utm_campaign=launch",
    "type": 301
  },
  {
    "source": "/go/bio",
    "destination": "/?utm_source=instagram&utm_medium=bio&utm_campaign=launch",
    "type": 301
  },
  {
    "source": "/go/email",
    "destination": "/?utm_source=email&utm_medium=newsletter&utm_campaign=launch",
    "type": 301
  }
],
```

- [ ] **Step 2: Validate JSON is valid**

```bash
node -e "require('./firebase.json'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "feat: add UTM short link redirects /go/* to firebase.json"
```

---

## Task 2: Create `landingAnalytics.js`

**Files:**
- Create: `landing_page/landingAnalytics.js`

- [ ] **Step 1: Create the module**

```js
// landing_page/landingAnalytics.js
let utmParams = {};
const seenSections = new Set();
const seenScrollDepths = new Set();

function readUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get('utm_source') || 'direct',
    utm_medium: p.get('utm_medium') || undefined,
    utm_campaign: p.get('utm_campaign') || undefined,
  };
}

function gtag(...args) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

function attachScrollListener() {
  const milestones = [25, 50, 75, 100];
  function onScroll() {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    const pct = Math.floor((scrolled / total) * 100);
    for (const m of milestones) {
      if (pct >= m && !seenScrollDepths.has(m)) {
        seenScrollDepths.add(m);
        gtag('event', 'scroll_depth', { depth: m, ...utmParams });
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

function attachSectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const name = entry.target.dataset.section;
        if (!name || seenSections.has(name)) continue;
        seenSections.add(name);
        gtag('event', 'section_viewed', { section_name: name, ...utmParams });
      }
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
}

export const landingAnalytics = {
  init(measurementId) {
    if (typeof window === 'undefined') return;
    utmParams = readUtmParams();

    // Bootstrap gtag if not already present
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: true });

    // Attach behavioral listeners after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        attachScrollListener();
        attachSectionObserver();
      });
    } else {
      attachScrollListener();
      attachSectionObserver();
    }
  },

  trackCtaClicked(label, section) {
    gtag('event', 'cta_clicked', { cta_label: label, section, ...utmParams });
  },

  trackCheckoutOpened(section) {
    gtag('event', 'checkout_opened', { section, ...utmParams });
  },

  trackCheckoutClosed(reason, fieldsFilled) {
    gtag('event', 'checkout_closed', { reason, fields_filled: fieldsFilled, ...utmParams });
  },

  trackFieldFocused(fieldName) {
    gtag('event', 'checkout_field_focused', { field_name: fieldName, ...utmParams });
  },

  trackFieldCompleted(fieldName) {
    gtag('event', 'checkout_field_completed', { field_name: fieldName, ...utmParams });
  },

  trackFormSubmitted() {
    gtag('event', 'checkout_submitted', { ...utmParams });
  },

  trackFormError(errorType) {
    gtag('event', 'checkout_error', { error_type: errorType, ...utmParams });
  },

  getUtmSource() {
    return utmParams.utm_source || 'direct';
  },
};
```

- [ ] **Step 2: Verify no import errors by checking Vite resolves the alias**

```bash
npm run build 2>&1 | grep -i "error\|landingAnalytics" | head -10
```

Expected: no errors mentioning `landingAnalytics`.

- [ ] **Step 3: Commit**

```bash
git add landing_page/landingAnalytics.js
git commit -m "feat: add landingAnalytics.js — GA4 event tracking module"
```

---

## Task 3: Wire GA4 Script + Init in `home.jsx`

**Files:**
- Modify: `landing_page/pages/home.jsx`

- [ ] **Step 1: Update home.jsx**

Replace the entire file content:

```jsx
import React, { useState, useEffect } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import FooterSection from '../components/landing/FooterSection';
import WhyRealwiseSection from '../components/landing/WhyRealwiseSection';
import CheckoutModal from '../components/landing/CheckoutModal';
import { landingAnalytics } from '../landingAnalytics';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export default function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSection, setCheckoutSection] = useState('');

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    // Inject gtag script
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => landingAnalytics.init(GA_MEASUREMENT_ID);
  }, []);

  function openCheckout(section) {
    setCheckoutSection(section);
    setCheckoutOpen(true);
    landingAnalytics.trackCheckoutOpened(section);
  }

  function closeCheckout(reason, fieldsFilled) {
    setCheckoutOpen(false);
    landingAnalytics.trackCheckoutClosed(reason, fieldsFilled);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <Header onBuy={() => openCheckout('header')} />
      <div className="pt-20">
        <HeroSection onBuy={() => openCheckout('hero')} />
        <PainPointsSection />
        <FeaturesSection />
        <DataOwnershipSection />
        <WhyRealwiseSection />
        <PricingSection onBuy={() => openCheckout('pricing')} />
        <FAQSection />
        <FinalCTASection onBuy={() => openCheckout('final-cta')} />
        <FooterSection />
      </div>
      <CheckoutModal
        open={checkoutOpen}
        section={checkoutSection}
        onClose={closeCheckout}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `VITE_GA_MEASUREMENT_ID` to `.env`**

Open `.env` (create if it doesn't exist) and add:

```
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Replace `G-XXXXXXXXXX` with your actual GA4 Measurement ID.

- [ ] **Step 3: Verify dev server starts cleanly**

```bash
npm run dev 2>&1 | head -20
```

Expected: no errors, dev server up at `http://localhost:5173`.

- [ ] **Step 4: Commit**

```bash
git add landing_page/pages/home.jsx .env
git commit -m "feat: inject GA4 script and init landingAnalytics on landing page load"
```

---

## Task 4: Add `data-section` Attributes + CTA Click Tracking to Sections

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`
- Modify: `landing_page/components/landing/PainPointsSection.jsx`
- Modify: `landing_page/components/landing/FeaturesSection.jsx`
- Modify: `landing_page/components/landing/DataOwnershipSection.jsx`
- Modify: `landing_page/components/landing/WhyRealwiseSection.jsx`
- Modify: `landing_page/components/landing/PricingSection.jsx`
- Modify: `landing_page/components/landing/FinalCTASection.jsx`

**Pattern for every section:**
1. Add `data-section="<name>"` to the outermost `<section>` element.
2. For sections with a CTA button that calls `onBuy`, wrap the call to fire `trackCtaClicked` first.

- [ ] **Step 1: Update HeroSection.jsx**

Find the outermost `<section>` tag (line 8) and add `data-section="hero"`:

```jsx
<section data-section="hero" className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
```

Find the `<Button>` that calls `onBuy` (the "Assumir o controle" button) and update its `onClick`:

```jsx
onClick={() => {
  landingAnalytics.trackCtaClicked('Assumir o controle', 'hero');
  onBuy();
}}
```

Add the import at the top of the file:

```jsx
import { landingAnalytics } from '../../landingAnalytics';
```

- [ ] **Step 2: Update PainPointsSection.jsx**

Add `data-section="pain-points"` to the outermost `<section>` element. No CTA button, no other changes.

- [ ] **Step 3: Update FeaturesSection.jsx**

Add `data-section="features"` to the outermost `<section>` element.

- [ ] **Step 4: Update DataOwnershipSection.jsx**

Add `data-section="data-ownership"` to the outermost `<section>` element.

- [ ] **Step 5: Update WhyRealwiseSection.jsx**

Add `data-section="why-realwise"` to the outermost `<section>` element.

- [ ] **Step 6: Update PricingSection.jsx**

Add `data-section="pricing"` to the outermost `<section>`. Add the import and update any CTA button `onClick`:

```jsx
import { landingAnalytics } from '../../landingAnalytics';
// ...
onClick={() => {
  landingAnalytics.trackCtaClicked('Começar agora', 'pricing');
  onBuy();
}}
```

- [ ] **Step 7: Update FinalCTASection.jsx**

Add `data-section="final-cta"` to the outermost `<section>`. Add the import and update the CTA button:

```jsx
import { landingAnalytics } from '../../landingAnalytics';
// ...
onClick={() => {
  landingAnalytics.trackCtaClicked('Quero o Realwise', 'final-cta');
  onBuy();
}}
```

- [ ] **Step 8: Verify in browser**

Start dev server (`npm run dev`), open `http://localhost:5173`, open DevTools Console and run:

```js
window.dataLayer
```

Scroll down the page. Expected: array grows with `section_viewed` entries as you pass each section.

- [ ] **Step 9: Commit**

```bash
git add landing_page/components/landing/
git commit -m "feat: add data-section attributes and CTA click tracking to landing sections"
```

---

## Task 5: Wire Checkout Tracking in `CheckoutModal.jsx`

**Files:**
- Modify: `landing_page/components/landing/CheckoutModal.jsx`

- [ ] **Step 1: Replace CheckoutModal.jsx**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { extractClientId, fetchClientConfig } from '@/config/clientConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';

const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL || '';
const PARTIAL_LEAD_URL = import.meta.env.VITE_PARTIAL_LEAD_URL || '';

export default function CheckoutModal({ open, onClose, section }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState(CHECKOUT_URL);
  const [partialLeadUrl, setPartialLeadUrl] = useState(PARTIAL_LEAD_URL);
  const savedPartialRef = useRef(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const clientId = extractClientId(window.location.pathname) || 'app';
        const config = await fetchClientConfig(clientId);
        setCheckoutUrl(config.checkoutUrl || CHECKOUT_URL);
        setPartialLeadUrl(config.partialLeadUrl || PARTIAL_LEAD_URL);
      } catch {
        // fallback to env vars
      }
    };
    loadConfig();
  }, []);

  // Reset form and partial-lead guard when modal opens
  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', whatsapp: '' });
      setError('');
      savedPartialRef.current = false;
    }
  }, [open]);

  function countFilledFields() {
    return [form.name, form.email, form.whatsapp].filter(Boolean).length;
  }

  function handleClose(reason) {
    onClose(reason, countFilledFields());
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  function handleFocus(e) {
    landingAnalytics.trackFieldFocused(e.target.name);
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    if (!value.trim()) return;
    landingAnalytics.trackFieldCompleted(name);

    // Partial lead capture: fire on email blur with valid format
    if (name === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !savedPartialRef.current) {
      savedPartialRef.current = true;
      savePartialLead({ email: value.trim().toLowerCase(), name: form.name.trim() || undefined });
    }

    // Add whatsapp to existing partial lead
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
    } catch {
      // never throw — analytics must not break the product
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, whatsapp } = form;

    if (!name.trim() || !email.trim() || !whatsapp.trim()) {
      setError('Preencha todos os campos.');
      landingAnalytics.trackFormError('validation');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido.');
      landingAnalytics.trackFormError('validation');
      return;
    }

    landingAnalytics.trackFormSubmitted();
    setLoading(true);
    setError('');

    try {
      const clientId = extractClientId(window.location.pathname);
      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          clientId: clientId !== 'app' ? clientId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao iniciar pagamento.');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      landingAnalytics.trackFormError('api');
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 pointer-events-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold">Quase lá!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Preencha seus dados para continuar
                  </p>
                </div>
                <button
                  onClick={() => handleClose('button')}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="Seu nome"
                    disabled={loading}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="voce@exemplo.com"
                    disabled={loading}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="(11) 99999-9999"
                    disabled={loading}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                {error && (
                  <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aguarde...
                    </>
                  ) : (
                    <>
                      Ir para pagamento — 12x de R$39,99
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Pagamento seguro via Stripe · Seus dados só seus
                </p>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Add `VITE_PARTIAL_LEAD_URL` to `.env`**

```
VITE_PARTIAL_LEAD_URL=https://<region>-<project>.cloudfunctions.net/savePartialLead
```

Leave this blank for now — fill it in after Task 6 deploys the function.

- [ ] **Step 3: Verify checkout events in browser**

Open dev server, open the checkout modal, type an email and tab away. In DevTools Console:

```js
window.dataLayer.filter(e => e.event?.startsWith('checkout'))
```

Expected: entries for `checkout_field_focused` and `checkout_field_completed`.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/CheckoutModal.jsx .env
git commit -m "feat: wire checkout field tracking and partial lead trigger in CheckoutModal"
```

---

## Task 6: Create `savePartialLead` Cloud Function

**Files:**
- Create: `functions/savePartialLead.js`
- Modify: `functions/index.js`

- [ ] **Step 1: Create `functions/savePartialLead.js`**

```js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

exports.savePartialLead = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { email, name, whatsapp, utmSource } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const source = utmSource || 'direct';

    try {
      const leadRef = db.collection('leads').doc(emailLower);
      const snap = await leadRef.get();
      const existing = snap.data();

      // Never downgrade a lead that's past form_partial
      const protectedStates = ['checkout_started', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];
      if (existing && protectedStates.includes(existing.state)) {
        // Still update whatsapp if missing and provided
        if (whatsapp && !existing.whatsapp) {
          await leadRef.update({ whatsapp: whatsapp.trim(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        res.status(200).json({ status: 'existing' });
        return;
      }

      await leadRef.set(
        {
          email: emailLower,
          ...(name ? { name: name.trim() } : {}),
          ...(whatsapp ? { whatsapp: whatsapp.trim() } : {}),
          state: 'form_partial',
          source,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(!snap.exists && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );

      // Increment daily landing_stats
      const statsRef = db.collection('landing_stats').doc(today);
      await statsRef.set(
        {
          partial_leads: admin.firestore.FieldValue.increment(1),
          [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );

      res.status(200).json({ status: 'saved' });
    } catch (err) {
      console.error('[savePartialLead]', err);
      res.status(500).json({ error: 'internal' });
    }
  });
});
```

- [ ] **Step 2: Export from `functions/index.js`**

Add at the bottom of `functions/index.js` (before the closing of any existing section):

```js
// ============================================================
// PARTIAL LEAD CAPTURE
// ============================================================
const savePartialLeadModule = require('./savePartialLead');
exports.savePartialLead = savePartialLeadModule.savePartialLead;
```

- [ ] **Step 3: Add `form_partial` guard to `onNewLead` in `functions/index.js`**

Find the `onNewLead` trigger (around line 633). After the `if (!email)` check, add:

```js
const state = snap.data().state;
if (state === 'form_partial') {
  console.log('[onNewLead] Skipping notification for form_partial lead');
  return;
}
```

The block should look like:

```js
exports.onNewLead = functions.firestore
  .document('leads/{leadId}')
  .onCreate(async (snap) => {
    const { name, email, whatsapp, createdAt } = snap.data();

    if (!email) {
      console.log('[onNewLead] No email on lead — skipping notification');
      return;
    }

    const state = snap.data().state;
    if (state === 'form_partial') {
      console.log('[onNewLead] Skipping notification for form_partial lead');
      return;
    }

    // ... rest of the function unchanged
```

- [ ] **Step 4: Deploy the function**

```bash
firebase deploy --only functions:savePartialLead
```

Expected: `✔ functions[savePartialLead]: Successful create operation.`

Copy the printed function URL and update `VITE_PARTIAL_LEAD_URL` in `.env`.

- [ ] **Step 5: Smoke test via curl**

```bash
curl -X POST https://<region>-<project>.cloudfunctions.net/savePartialLead \
  -H "Content-Type: application/json" \
  -d '{"email":"test-partial@example.com","name":"Test","utmSource":"whatsapp"}'
```

Expected response: `{"status":"saved"}`

Check Firestore: `leads/test-partial@example.com` should exist with `state: "form_partial"` and `source: "whatsapp"`. `landing_stats/YYYY-MM-DD` should exist with `partial_leads: 1` and `sources.whatsapp: 1`.

- [ ] **Step 6: Commit**

```bash
git add functions/savePartialLead.js functions/index.js
git commit -m "feat: add savePartialLead function with landing_stats increment and onNewLead guard"
```

---

## Task 7: Increment `landing_stats` in `createCheckoutSession`

**Files:**
- Modify: `functions/createCheckoutSession.js`

- [ ] **Step 1: Add the increment after the lead upsert**

In `functions/createCheckoutSession.js`, find the block that upserts the lead (around line 95-109). Directly after the `leadRef.set(...)` call, add:

```js
// Increment daily checkout_started counter
const today = new Date().toISOString().slice(0, 10);
const source = req.body.utmSource || 'direct';
db.collection('landing_stats').doc(today).set(
  {
    checkout_started: admin.firestore.FieldValue.increment(1),
    [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
  },
  { merge: true }
).catch(err => console.error('[createCheckoutSession] landing_stats increment failed:', err));
```

Note: this is intentionally fire-and-forget (no `await`) so a stats write failure never blocks the Stripe session creation.

- [ ] **Step 2: Pass `utmSource` from the checkout form**

The `CheckoutModal` does not currently send `utmSource` to `createCheckoutSession`. Update the `body` in `CheckoutModal.jsx`'s `handleSubmit` to include it:

```js
body: JSON.stringify({
  name: name.trim(),
  email: email.trim().toLowerCase(),
  whatsapp: whatsapp.trim(),
  clientId: clientId !== 'app' ? clientId : undefined,
  utmSource: landingAnalytics.getUtmSource(),
}),
```

- [ ] **Step 3: Deploy**

```bash
firebase deploy --only functions:createCheckoutSession
```

- [ ] **Step 4: Commit**

```bash
git add functions/createCheckoutSession.js landing_page/components/landing/CheckoutModal.jsx
git commit -m "feat: increment landing_stats.checkout_started on createCheckoutSession"
```

---

## Task 8: Admin Dashboard Funnel Panel in `LeadsDashboard.jsx`

**Files:**
- Modify: `src/pages/admin/LeadsDashboard.jsx`

- [ ] **Step 1: Add `useLandingStats` hook inside `LeadsDashboard.jsx`**

Add this hook at the top of the file (after imports):

```js
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
```

(Replace existing `firebase/firestore` import — just add `getDocs` and `where` to whatever is already imported.)

Add this hook function before the `LeadsDashboard` component:

```js
function useLandingStats(db) {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    async function load() {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().slice(0, 10);
      });

      const snaps = await Promise.all(
        days.map(day => db.collection('landing_stats').doc(day).get())
      );

      setStats(
        snaps.map((snap, i) => ({
          date: days[i],
          partial_leads: snap.data()?.partial_leads || 0,
          checkout_started: snap.data()?.checkout_started || 0,
          sources: snap.data()?.sources || {},
        }))
      );
    }
    load();
  }, [db]);

  return stats;
}
```

- [ ] **Step 2: Add the funnel panel to the JSX**

Inside `LeadsDashboard`, call the hook:

```js
const landingStats = useLandingStats(db);
```

Then compute totals:

```js
const totalPartial = landingStats.reduce((s, d) => s + d.partial_leads, 0);
const totalCheckoutStarted = landingStats.reduce((s, d) => s + d.checkout_started, 0);
const sourceTotals = landingStats.reduce((acc, d) => {
  Object.entries(d.sources).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
  return acc;
}, {});
```

Add this panel just before the leads table in the JSX (find the return statement and add before the table):

```jsx
{/* Landing Funnel Panel */}
<div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
    Funil de conversão — últimos 7 dias
  </h3>
  <div className="flex items-center gap-4 mb-4 flex-wrap">
    <div className="text-center">
      <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totalPartial}</div>
      <div className="text-xs text-slate-500">Leads parciais</div>
    </div>
    <div className="text-slate-300 dark:text-slate-600 text-xl">→</div>
    <div className="text-center">
      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalCheckoutStarted}</div>
      <div className="text-xs text-slate-500">Checkout iniciado</div>
      {totalPartial > 0 && (
        <div className="text-xs text-slate-400">{((totalCheckoutStarted / totalPartial) * 100).toFixed(0)}%</div>
      )}
    </div>
    <div className="text-slate-300 dark:text-slate-600 text-xl">→</div>
    <div className="text-center">
      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{paidLeads}</div>
      <div className="text-xs text-slate-500">Pagos (total)</div>
      {totalCheckoutStarted > 0 && (
        <div className="text-xs text-slate-400">{((paidLeads / totalCheckoutStarted) * 100).toFixed(0)}%</div>
      )}
    </div>
  </div>
  {Object.keys(sourceTotals).length > 0 && (
    <div className="flex gap-3 flex-wrap">
      {Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
        <span key={source} className="px-2 py-1 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {source}: {count}
        </span>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Fix Firestore import — use the `db` prop directly**

The `db` prop passed to `LeadsDashboard` is a Firestore instance from the admin app (not the per-client instance). The hook above uses the native SDK `.collection()` style. If the admin app uses modular SDK (v9+), update the hook to use `doc` and `getDoc`:

```js
import { doc, getDoc } from 'firebase/firestore';

// inside useLandingStats:
const snaps = await Promise.all(
  days.map(day => getDoc(doc(db, 'landing_stats', day)))
);
```

Check which style `LeadsDashboard` already uses for other reads (it uses `collection(db, 'leads')` with modular SDK). Use the modular style consistently.

- [ ] **Step 4: Verify in browser**

Navigate to the Admin dashboard. The funnel panel should appear above the leads table. If `landing_stats` docs don't exist yet (no data), all values show `0` — that's correct.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/LeadsDashboard.jsx
git commit -m "feat: add landing funnel panel to LeadsDashboard reading landing_stats"
```

---

## Task 9: Final Deploy & Smoke Test

- [ ] **Step 1: Build the frontend**

```bash
npm run build 2>&1 | tail -5
```

Expected: `dist/` built successfully, no errors.

- [ ] **Step 2: Deploy hosting**

```bash
firebase deploy --only hosting
```

- [ ] **Step 3: Test short link redirect**

Open `https://realwise.com.br/go/whatsapp` in a browser. Expected: redirects to `https://realwise.com.br/?utm_source=whatsapp&utm_medium=social&utm_campaign=launch`.

- [ ] **Step 4: Verify GA4 events in DebugView**

In GA4 → Admin → DebugView, open the landing page in a separate browser window. Scroll down, open checkout, type an email. Expected events in DebugView: `section_viewed`, `scroll_depth`, `checkout_opened`, `checkout_field_focused`, `checkout_field_completed`.

- [ ] **Step 5: Verify partial lead in Firestore**

After typing a valid email in the checkout modal and tabbing away, check Firestore `leads` collection. Expected: a doc with `state: "form_partial"` and `source: "direct"` (or the UTM source if you arrived via `/go/whatsapp`).

- [ ] **Step 6: Final commit tag**

```bash
git tag analytics-v1
git push origin main --tags
```
