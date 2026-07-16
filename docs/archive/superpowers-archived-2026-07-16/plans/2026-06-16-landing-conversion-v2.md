# Landing Conversion v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the Realwise landing page around the "abandoned spreadsheet" pain instead of the "cancel your subscription" price attack, promote privacy to a central conviction section, add a founder story and live-import demo, make pricing admin-configurable from a single Firestore source of truth, and reduce checkout friction — without publishing anything that needs real assets (video, founder photo, testimonials) that don't exist yet.

**Architecture:** Pure frontend copy/component changes inside `landing_page/components/landing/*` and `landing_page/pages/home.jsx`, reusing the existing Framer Motion + Tailwind patterns already in the codebase. Pricing becomes data-driven: a new Firestore doc `config/pricing` is the single source read by both the landing (`PricingSection.jsx`, `CheckoutModal.jsx`) and the backend (`functions/index.js` `validateCouponAndComputeAmount`), and is only writable through a new admin-only callable `updatePricingConfig` (modeled on the existing `updateLeadState`). No new infra; same Cloud Functions project, same Firestore rules pattern (`isAdmin()`), same admin React app under `src/pages/admin/`.

**Tech Stack:** React 19, Vite, Tailwind CSS v4 (existing `violet-*` palette, no custom colors), Framer Motion (already a dependency), Firebase Functions v1 (`firebase-functions`), Firestore, React Router v7 (admin app).

**Placeholders allowed (explicit user instruction — do not block on missing assets):**
- Founder photo: `public/founder.jpg` does not exist yet. Render `FounderStory.jsx` with a placeholder `<div>` (initials avatar) and a code comment noting where to drop the real photo — never a fake stock photo.
- Video: no `videoUrl` exists. `VideoSection.jsx` must accept a `videoUrl` prop and render `null` when absent — this is the "do not publish" gate already in the spec.
- Testimonials: `Testimonials.jsx` renders `null` when its array is empty — same gate, never mock data.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `landing_page/components/landing/HeroSection.jsx` | Modify | New headline/sub (variant A), emerald→violet, optional `VideoSection` slot |
| `landing_page/components/landing/VideoSection.jsx` | Create | Lazy video player, renders `null` without `videoUrl` |
| `landing_page/components/landing/PainPointsSection.jsx` | Modify | 4 cards: dor + alívio in the same sentence |
| `landing_page/components/landing/LiveImportDemo.jsx` | Create | Mocked statement → animated auto-categorization, 100% local |
| `landing_page/components/landing/DataOwnershipSection.jsx` | Modify | Rewritten as the central "Privacidade" conviction section (reuse existing file/slot, don't duplicate) |
| `landing_page/components/landing/FounderStory.jsx` | Create | Founder photo placeholder + first-person copy |
| `landing_page/components/landing/Testimonials.jsx` | Create | Renders `null` when empty; never mock |
| `landing_page/components/landing/FeaturesSection.jsx` | Modify | emerald→violet only (copy stays, it's already terse) |
| `landing_page/components/landing/PricingSection.jsx` | Modify | Reads `config/pricing` from Firestore, derives installment/discount, emerald→violet |
| `landing_page/components/landing/CheckoutModal.jsx` | Modify | Reads `config/pricing` instead of hardcoded `BASE_PRICE`/`PROMO_PRICE`; trims step 1 to email-only, moves WhatsApp to post-payment |
| `landing_page/components/landing/GuaranteeSection.jsx` | Create | 30-day guarantee block, sits next to pricing |
| `landing_page/components/landing/FAQSection.jsx` | Modify | Add 3 FAQ items, emerald→violet hover |
| `landing_page/components/landing/FooterSection.jsx` | Modify | Add floating WhatsApp button (new small component) |
| `landing_page/components/landing/WhatsAppFloatingButton.jsx` | Create | Global sticky WhatsApp button |
| `landing_page/pages/home.jsx` | Modify | Reorder sections per new funnel |
| `landing_page/pages/PurchaseSuccess.jsx` | Modify | Honest "configurando seu acesso" copy + WhatsApp |
| `functions/updatePricingConfig.js` | Create | Admin-only callable, modeled on `functions/updateLeadState.js` |
| `functions/index.js` | Modify | Export `updatePricingConfig`; `validateCouponAndComputeAmount` reads `config/pricing` instead of constant `BASE_AMOUNT` |
| `firestore.rules` | Modify | `config/pricing`: public read, admin-only write |
| `src/pages/admin/PricingConfigPage.jsx` | Create | Admin card to edit pricing, modeled on `CouponsPage.jsx`/`LeadsDashboard.jsx` KPI card pattern |
| `src/pages/admin/AdminApp.jsx` | Modify | New `pricing` route + nav link |

---

## Task 1: Firestore `config/pricing` doc + rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the rule**

Open `firestore.rules` and add this match block right after the `admins/{email}` block (search for `match /admins/{email}` to find the spot):

```
    match /config/pricing {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
```

- [ ] **Step 2: Deploy rules only (no other changes bundled)**

Run: `firebase deploy --only firestore:rules`
Expected: `firestore: released rules firestore.rules to cloud.firestore`

- [ ] **Step 3: Seed the initial doc manually**

Run (replace `<PROJECT_ID>` with the central admin project id used for `leads`/`coupons`, find it via `firebase use` or `.firebaserc`):

```bash
firebase firestore:set config/pricing '{"originalCents":47988,"totalCents":23880,"installments":12,"active":true,"campaignLabel":"Lançamento"}' --project <PROJECT_ID>
```

If that CLI command isn't available in your Firebase CLI version, set it once via the Firebase Console → Firestore → create document `config/pricing` with the same fields (types: number, number, number, boolean, string).

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: add public-read/admin-write rules for config/pricing"
```

---

## Task 2: `updatePricingConfig` Cloud Function

**Files:**
- Create: `functions/updatePricingConfig.js`
- Modify: `functions/index.js`

- [ ] **Step 1: Write the function**

```javascript
// functions/updatePricingConfig.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.updatePricingConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const callerEmail = context.auth.token.email;
  const adminDoc = await db.collection('admins').doc(callerEmail).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not an admin');
  }

  const { originalCents, totalCents, installments, active, campaignLabel } = data;

  if (!Number.isInteger(originalCents) || originalCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'originalCents must be a positive integer.');
  }
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents must be a positive integer.');
  }
  if (!Number.isInteger(installments) || installments <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'installments must be a positive integer.');
  }
  if (totalCents > originalCents) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents não pode ser maior que originalCents.');
  }
  const installmentCents = Math.round(totalCents / installments);
  if (installmentCents * installments !== totalCents) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents deve ser divisível por installments sem resto.');
  }

  await db.collection('config').doc('pricing').set({
    originalCents,
    totalCents,
    installments,
    active: !!active,
    campaignLabel: campaignLabel || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: callerEmail,
  }, { merge: true });

  return { success: true };
});
```

- [ ] **Step 2: Wire it up in `functions/index.js`**

Find line 873-874 (`const { updateLeadState } = require('./updateLeadState'); exports.updateLeadState = updateLeadState;`) and add right after:

```javascript
const { updatePricingConfig } = require('./updatePricingConfig');
exports.updatePricingConfig = updatePricingConfig;
```

- [ ] **Step 3: Replace `BASE_AMOUNT` constant with a Firestore-backed lookup**

In `functions/index.js`, remove line 20 (`const BASE_AMOUNT = 239;`) and add this helper near `validateCouponAndComputeAmount` (which starts at line 44):

```javascript
async function getBaseAmount() {
  const snap = await db.collection('config').doc('pricing').get();
  const data = snap.data();
  if (!data || !data.active) return 239; // fallback if doc missing/inactive
  return data.totalCents / 100;
}
```

Then update `validateCouponAndComputeAmount` (currently starts at line 44) to be:

```javascript
async function validateCouponAndComputeAmount(couponCode) {
  const BASE_AMOUNT = await getBaseAmount();

  if (!couponCode || typeof couponCode !== 'string') {
    return { amount: BASE_AMOUNT, couponDoc: null };
  }
  // ...existing body below this point stays the same, but replace every
  // remaining bare `BASE_AMOUNT` reference (lines 77 and 79 in the original
  // file) with the local `BASE_AMOUNT` now computed above — no other changes.
```

Leave the rest of the function (coupon lookup, discount math at the old lines 49-83) untouched — only the source of `BASE_AMOUNT` changes from a constant to this async lookup.

- [ ] **Step 4: Deploy functions**

```bash
cd functions && npm install
firebase deploy --only functions:updatePricingConfig,functions:createPayment,functions:processPayment
```
Expected: all three deploy successfully with no errors in the output.

- [ ] **Step 5: Commit**

```bash
git add functions/updatePricingConfig.js functions/index.js
git commit -m "feat: make checkout base price read from config/pricing instead of a constant"
```

---

## Task 3: Admin "Preço da Landing" page

**Files:**
- Create: `src/pages/admin/PricingConfigPage.jsx`
- Modify: `src/pages/admin/AdminApp.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/admin/PricingConfigPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

function brl(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PricingConfigPage({ db, functions }) {
  const [pricing, setPricing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data) {
        setPricing(data);
        setForm({
          originalReais: (data.originalCents / 100).toString(),
          totalReais: (data.totalCents / 100).toString(),
          installments: data.installments.toString(),
          active: data.active,
          campaignLabel: data.campaignLabel || '',
        });
      }
    });
    return () => unsub();
  }, [db]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const originalCents = Math.round(parseFloat(form.originalReais.replace(',', '.')) * 100);
      const totalCents = Math.round(parseFloat(form.totalReais.replace(',', '.')) * 100);
      const installments = parseInt(form.installments, 10);
      await httpsCallable(functions, 'updatePricingConfig')({
        originalCents,
        totalCents,
        installments,
        active: form.active,
        campaignLabel: form.campaignLabel,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, functions]);

  if (!form) return <div className="p-6 text-gray-400">Carregando...</div>;

  const totalCents = Math.round(parseFloat(form.totalReais.replace(',', '.') || '0') * 100);
  const originalCents = Math.round(parseFloat(form.originalReais.replace(',', '.') || '0') * 100);
  const installments = parseInt(form.installments, 10) || 1;
  const installmentCents = Math.round(totalCents / installments);
  const discountPercent = originalCents > 0 ? Math.round((1 - totalCents / originalCents) * 100) : 0;

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-bold text-white mb-4">Preço da Landing</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Promoção ativa
        </label>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço original (R$)</label>
          <input
            type="text"
            value={form.originalReais}
            onChange={(e) => setForm({ ...form, originalReais: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço final (R$)</label>
          <input
            type="text"
            value={form.totalReais}
            onChange={(e) => setForm({ ...form, totalReais: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Parcelas</label>
          <input
            type="text"
            value={form.installments}
            onChange={(e) => setForm({ ...form, installments: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Rótulo da campanha (opcional)</label>
          <input
            type="text"
            value={form.campaignLabel}
            onChange={(e) => setForm({ ...form, campaignLabel: e.target.value })}
            placeholder="Lançamento"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prévia</p>
        <p className="text-white font-bold text-xl">{installments}x de {brl(installmentCents)}</p>
        <p className="text-gray-400 text-sm">ou {brl(totalCents)} à vista</p>
        <p className="text-gray-500 text-xs mt-1">
          <span className="line-through">{brl(originalCents)}</span> · {discountPercent}% OFF
          {form.campaignLabel && ` · ${form.campaignLabel}`}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {savedAt && !error && <p className="text-emerald-400 text-sm mb-3">Salvo às {savedAt.toLocaleTimeString('pt-BR')}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `AdminApp.jsx`**

Add the lazy import near the others (after line 15 `const CouponsPage = lazy(() => import('./CouponsPage'));`):

```javascript
const PricingConfigPage = lazy(() => import('./PricingConfigPage'));
```

Add the nav link after the `Cupons` link (line 94):

```jsx
<NavLink to="pricing" className={navLinkClass}>Preço</NavLink>
```

Add the route after the `coupons` route (line 109):

```jsx
<Route path="pricing" element={<PricingConfigPage db={adminDb} functions={adminFunctions} />} />
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, open `http://localhost:5173/admin/pricing` (sign in as an admin email already in `admins/{email}`), confirm the form loads current values, change `campaignLabel`, save, and verify the Firestore doc `config/pricing` updates with `updatedBy` set to your email.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/PricingConfigPage.jsx src/pages/admin/AdminApp.jsx
git commit -m "feat: add admin page to edit landing pricing config"
```

---

## Task 4: Color swap — emerald/teal → violet across `landing_page/`

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`
- Modify: `landing_page/components/landing/DataOwnershipSection.jsx`
- Modify: `landing_page/components/landing/FeaturesSection.jsx`
- Modify: `landing_page/components/landing/PricingSection.jsx`
- Modify: `landing_page/components/landing/FAQSection.jsx`
- Modify: `landing_page/components/landing/CheckoutModal.jsx`

This task is a mechanical find/replace per file — do it before the copy-rewrite tasks below so later diffs are copy-only, not copy+color mixed.

- [ ] **Step 1: Replace in each file**

Run this in the repo root (safe — only touches `landing_page/components/landing/*.jsx`, and `teal` only appears as a gradient partner to emerald so it maps to a violet shade too):

```bash
cd landing_page/components/landing
sed -i '' \
  -e 's/emerald-50/violet-50/g' \
  -e 's/emerald-200/violet-200/g' \
  -e 's/emerald-300/violet-300/g' \
  -e 's/emerald-400/violet-400/g' \
  -e 's/emerald-500/violet-500/g' \
  -e 's/emerald-600/violet-600/g' \
  -e 's/emerald-700/violet-700/g' \
  -e 's/emerald-800/violet-800/g' \
  -e 's/emerald-950/violet-950/g' \
  -e 's/teal-400/violet-400/g' \
  -e 's/teal-500/indigo-500/g' \
  HeroSection.jsx DataOwnershipSection.jsx FeaturesSection.jsx PricingSection.jsx FAQSection.jsx
```

Do **not** run this on `CheckoutModal.jsx` — its only two `emerald` hits (lines 492, 503) are the "50% OFF" badge background, which should stay a distinct color from the violet price badge for visual contrast. Leave those as `bg-emerald-600` (or change manually to `bg-rose-600` if you want to free up emerald entirely — your call, not required by the spec).

- [ ] **Step 2: Verify no stray emerald/teal remain in scope (except the intentional CheckoutModal badge)**

```bash
grep -rn "emerald\|teal" landing_page/components/landing/*.jsx
```
Expected: only `CheckoutModal.jsx` lines 492 and 503 (the "50% OFF" badges) show up.

- [ ] **Step 3: Visual check**

`npm run dev`, open `http://localhost:5173/app/` (landing route) in light and dark mode, confirm hero gradient, pricing card top border, feature icons, and FAQ hover are violet, not green.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/HeroSection.jsx landing_page/components/landing/DataOwnershipSection.jsx landing_page/components/landing/FeaturesSection.jsx landing_page/components/landing/PricingSection.jsx landing_page/components/landing/FAQSection.jsx
git commit -m "style: swap emerald/teal accents for violet to match app brand color"
```

---

## Task 5: Rewrite Hero

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`

- [ ] **Step 1: Replace headline, sub, badge, and CTA text**

Replace lines 36-46 (headline + paragraph) with:

```jsx
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            A sua planilha financeira
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              que se preenche sozinha.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-2 leading-relaxed">
            Importe seu extrato e veja pra onde vai cada real — sem lançar tudo na mão, sem conectar seu banco a ninguém. Continua 100% seu, no seu Google. Pra sempre.
          </p>
```

Replace the CTA button text on line 54 (`Assumir o controle`) with `Quero o meu acesso` (keep the `landingAnalytics.trackCtaClicked` first argument in sync — it's a label used only for analytics, so update it too):

```jsx
            <Button
              size="lg"
              onClick={() => { landingAnalytics.trackCtaClicked('Quero o meu acesso', 'hero'); onBuy(); }}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Quero o meu acesso
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
```

Replace the trust-badge line 20-25 text:

```jsx
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200/50 dark:border-violet-800/50">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              Pagamento único · 30 dias de garantia · Seus dados só seus
            </span>
          </div>
```

Add a credibility line right after the button block (after the closing `</div>` of the CTA flex container, before the trust-icons `<div className="flex flex-wrap...">` on line 59):

```jsx
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">
            Feito no Brasil, por quem cansou de planilha morta e de app que quer ler todas as suas contas.
          </p>
```

- [ ] **Step 2: Add the optional video slot**

After the closing `</motion.div>` for the text block (around line 72) and before the screenshot `<motion.div>` (line 74), add:

```jsx
        <VideoSection videoUrl={import.meta.env.VITE_FOUNDER_VIDEO_URL} />
```

Add the import at the top of the file (after line 5):

```javascript
import VideoSection from './VideoSection';
```

- [ ] **Step 3: Visual check**

`npm run dev`, confirm new headline/sub/CTA render, no console errors about `VideoSection` (it will render `null` until Task 6 exists — do this step after Task 6, or stub `VideoSection.jsx` with `export default function VideoSection() { return null; }` temporarily).

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/HeroSection.jsx
git commit -m "feat: reposition hero copy around the self-filling spreadsheet pitch"
```

---

## Task 6: Video section (placeholder-gated)

**Files:**
- Create: `landing_page/components/landing/VideoSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// landing_page/components/landing/VideoSection.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

// Renders nothing until a real video URL is provided via VITE_FOUNDER_VIDEO_URL.
// Do not publish a placeholder/stock video here — wait for the real recording.
export default function VideoSection({ videoUrl }) {
  const [playing, setPlaying] = useState(false);

  if (!videoUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="max-w-2xl mx-auto mt-10 mb-4"
    >
      <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900 shadow-xl">
        {playing ? (
          <video src={videoUrl} controls autoPlay className="w-full h-full object-cover" />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center group"
            aria-label="Reproduzir vídeo"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-violet-600 ml-0.5" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify the gate works**

`npm run dev` without `VITE_FOUNDER_VIDEO_URL` set in `.env` — confirm nothing renders where the video would go. Then temporarily add `VITE_FOUNDER_VIDEO_URL=/test.mp4` to `.env` (any value) and confirm the play-button placeholder appears; remove the env var afterward so nothing accidentally ships.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/VideoSection.jsx
git commit -m "feat: add gated video section that renders nothing without a real video URL"
```

---

## Task 7: Rewrite pain points (dor + alívio in one sentence)

**Files:**
- Modify: `landing_page/components/landing/PainPointsSection.jsx`

- [ ] **Step 1: Read the current file to confirm structure before editing**

Run: `cat landing_page/components/landing/PainPointsSection.jsx`
(Confirms the `pains` array shape — `{ title, desc }` — and how it's mapped, since this file wasn't fully quoted during research.)

- [ ] **Step 2: Replace the `pains` array**

Replace the existing array (the 4 `{ title, desc }` entries) with:

```javascript
const pains = [
  { title: 'Você montou uma planilha linda — e abandonou no segundo mês.', desc: 'Aqui você importa o extrato e ela se preenche. Você só olha.' },
  { title: 'Lançar cada gasto na mão cansa, então em algum momento você para.', desc: 'Categorização automática. O trabalho é do app, não seu.' },
  { title: 'Os apps grátis querem se conectar a todas as suas contas.', desc: 'O Realwise não pede acesso ao seu banco. Você importa o extrato, e pronto.' },
  { title: 'No fim do mês some dinheiro e você não sabe pra onde foi.', desc: 'Cada real categorizado, num lugar só, no celular e no computador.' },
];
```

Keep whatever JSX rendering structure already maps `title`/`desc` to card markup — only the data array changes, not the component shape.

- [ ] **Step 3: Color check**

If the file used `emerald` for icon/border accents (not caught by Task 4's targeted file list), grep it: `grep -n emerald landing_page/components/landing/PainPointsSection.jsx`. If any hits appear, replace with the equivalent `violet` shade manually.

- [ ] **Step 4: Visual check**

`npm run dev`, scroll to the pain-points section, confirm all 4 cards show the new dor+alívio copy.

- [ ] **Step 5: Commit**

```bash
git add landing_page/components/landing/PainPointsSection.jsx
git commit -m "feat: rewrite pain points to validate the spreadsheet choice and pair pain with relief"
```

---

## Task 8: Live import demo

**Files:**
- Create: `landing_page/components/landing/LiveImportDemo.jsx`

- [ ] **Step 1: Write the component**

100% local mock data, no network calls — coherent with the "no data leaves your control" message.

```jsx
// landing_page/components/landing/LiveImportDemo.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MOCK_TRANSACTIONS = [
  { desc: 'IFOOD *IFOOD', amount: -47.9, category: 'Alimentação' },
  { desc: 'UBER *TRIP', amount: -23.5, category: 'Transporte' },
  { desc: 'NETFLIX.COM', amount: -39.9, category: 'Assinaturas' },
  { desc: 'POSTO SHELL', amount: -150.0, category: 'Transporte' },
  { desc: 'PIX RECEBIDO - SALARIO', amount: 4200.0, category: 'Renda' },
  { desc: 'FARMACIA DROGASIL', amount: -68.3, category: 'Saúde' },
];

function fmt(v) {
  const sign = v < 0 ? '-' : '+';
  return `${sign} R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;
}

export default function LiveImportDemo() {
  const [started, setStarted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const handleImport = () => {
    setStarted(true);
    setRevealedCount(0);
    MOCK_TRANSACTIONS.forEach((_, i) => {
      setTimeout(() => setRevealedCount(i + 1), 400 * (i + 1));
    });
  };

  return (
    <section data-section="live-demo" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Veja a mágica.</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            É assim que parece. Você traz o extrato, o Realwise faz o resto. Nenhum dado seu sai do seu controle — este exemplo é só uma simulação local.
          </p>
        </motion.div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
          {!started ? (
            <div className="p-10 flex flex-col items-center gap-4">
              <Upload className="w-10 h-10 text-violet-500" />
              <Button onClick={handleImport} className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6">
                Importar exemplo
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              <AnimatePresence>
                {MOCK_TRANSACTIONS.slice(0, revealedCount).map((tx) => (
                  <motion.li
                    key={tx.desc}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{tx.desc}</p>
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                        <Check className="w-3 h-3" /> {tx.category}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${tx.amount < 0 ? 'text-slate-600 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fmt(tx.amount)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
```

Note: positive amounts keep `emerald` — that's the existing dashboard convention from CLAUDE.md ("verde fica só para valores positivos/entradas"), not a leftover brand color, so do not swap it to violet.

- [ ] **Step 2: Visual check**

`npm run dev`, scroll to the demo, click "Importar exemplo", confirm transactions appear one by one with categories.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/LiveImportDemo.jsx
git commit -m "feat: add local mocked live-import demo section"
```

---

## Task 9: Promote Privacy section (rewrite `DataOwnershipSection.jsx`)

**Files:**
- Modify: `landing_page/components/landing/DataOwnershipSection.jsx`

This file already exists and is the closest match to spec section 3.6 — rewrite its copy in place rather than creating a duplicate `PrivacySection.jsx`.

- [ ] **Step 1: Replace the headline/paragraph (lines 28-35)**

```jsx
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Seus dados são seus. Ponto.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A maioria dos apps de finanças precisa se conectar às suas contas e guardar tudo nos servidores deles. O Realwise faz o contrário: seus dados ficam no seu próprio Google, na sua conta. Nenhum servidor nosso tem acesso. Não vendemos dado, não treinamos IA com o seu dinheiro, não temos como ler nada.
          </p>
          <p className="text-base text-slate-500 dark:text-slate-500 max-w-xl mx-auto mt-4">
            É a privacidade que você já tinha na planilha — agora sem o trabalho da planilha.
          </p>
```

- [ ] **Step 2: Replace the `benefits` array (lines 11-15) with the three short badges from the spec**

```javascript
const benefits = [
  { icon: Lock, text: 'No seu Google' },
  { icon: ShieldCheck, text: 'Sem conexão com seu banco' },
  { icon: Download, text: 'Você leva tudo se quiser sair' },
];
```

(Keep the `steps` array and its rendering as-is — it already shows the "you connect Google → Firebase in your account → Realwise reads only when you use it" flow, which still supports the new copy.)

- [ ] **Step 3: Visual check**

`npm run dev`, confirm the section now reads "Seus dados são seus. Ponto." with the three new badges.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/DataOwnershipSection.jsx
git commit -m "feat: rewrite privacy section as the central conviction, not a footnote"
```

---

## Task 10: Founder story (photo placeholder)

**Files:**
- Create: `landing_page/components/landing/FounderStory.jsx`

- [ ] **Step 1: Write the component with a placeholder avatar**

```jsx
// landing_page/components/landing/FounderStory.jsx
import React from 'react';
import { motion } from 'framer-motion';

// Drop the real photo at public/founder.jpg and switch the placeholder
// <div> below for an <img src="/founder.jpg" /> once it exists.
export default function FounderStory() {
  return (
    <section data-section="founder" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center gap-6"
        >
          <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-2xl font-bold text-violet-600 dark:text-violet-300">
            JL
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold">
            "Eu construí o Realwise porque eu queria a planilha que se mantivesse sozinha."
          </h2>

          <div className="text-left text-slate-600 dark:text-slate-400 leading-relaxed space-y-4">
            <p>
              Sou Jonatha, desenvolvedor. Como muita gente, eu já montei planilha de gastos cheia de aba e fórmula — e larguei, porque manter aquilo vivo é exaustivo. Experimentei apps, mas todos queriam se conectar às minhas contas e guardar tudo do lado deles. Eu não queria entregar isso.
            </p>
            <p>
              Então fiz o Realwise com uma regra simples: você importa seu extrato, o app organiza, e os dados ficam no seu Google — só seus. Sem conexão com banco, sem servidor meu lendo nada. A leveza de um app, com a privacidade de uma planilha.
            </p>
            <p>
              Não tenho investidor pra agradar nem meta de reter você à força. Tenho o compromisso de te entregar a ferramenta que eu queria ter.
            </p>
          </div>

          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">— Jonatha Lima, fundador</span>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Visual check**

`npm run dev`, confirm the section renders with the "JL" avatar placeholder — no broken image request for `/founder.jpg`.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/FounderStory.jsx
git commit -m "feat: add founder story section with avatar placeholder pending real photo"
```

---

## Task 11: Testimonials (hidden until real content exists)

**Files:**
- Create: `landing_page/components/landing/Testimonials.jsx`

- [ ] **Step 1: Write the component**

```jsx
// landing_page/components/landing/Testimonials.jsx
import React from 'react';
import { motion } from 'framer-motion';

// Never seed this array with invented text — empty means the section
// doesn't render. Fill only with real, permission-granted testimonials.
const testimonials = [];

export default function Testimonials() {
  if (testimonials.length === 0) return null;

  return (
    <section data-section="testimonials" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">Quem usa, recomenda.</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.nome} className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {t.foto && <img src={t.foto} alt={t.nome} className="w-10 h-10 rounded-full mb-3" />}
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">"{t.texto}"</p>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{t.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it's invisible**

`npm run dev`, confirm no "Quem usa, recomenda" section appears anywhere on the page (empty array → `null`).

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/Testimonials.jsx
git commit -m "feat: add testimonials section, hidden until real testimonials exist"
```

---

## Task 12: Pricing section — admin-configurable, new hero numbers, legal disclosure

**Files:**
- Modify: `landing_page/components/landing/PricingSection.jsx`

- [ ] **Step 1: Add Firestore read + derived values**

Replace the top of the file (imports + component signature, lines 1-26) with:

```jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Lock, Shield, Smartphone, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAnalytics } from '../../landingAnalytics';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const included = [
  'Dashboard e transações',
  'Contas a pagar e cartões',
  'Importação de extrato',
  'Planejador e orçamento',
  'Carteira de investimentos',
  'Dados no seu Firebase',
  'Suporte vitalício',
  'Segurança sempre grátis',
];

const trust = [
  { icon: Lock, text: '100% seguro (Mercado Pago)' },
  { icon: Shield, text: 'Dados 100% seus' },
  { icon: Smartphone, text: 'Desktop + Mobile' },
  { icon: Database, text: 'Seu Firebase' },
];

const FALLBACK_PRICING = { originalCents: 47988, totalCents: 23880, installments: 12, active: true, campaignLabel: null };

function fmt(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default function PricingSection({ onBuy, couponCode = '' }) {
  const [pricing, setPricing] = useState(FALLBACK_PRICING);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data && data.active) setPricing(data);
    });
    return () => unsub();
  }, []);

  const installmentCents = Math.round(pricing.totalCents / pricing.installments);
  const discountPercent = Math.round((1 - pricing.totalCents / pricing.originalCents) * 100);
```

`@/firebase` exports a live `db` binding once `ClientConfigContext` initializes Firebase — confirm this import resolves by checking `src/firebase.js` exports `db` (it already does per CLAUDE.md's "Multi-Client Routing" section). If the landing route renders outside `ClientConfigContext` (no client config loaded), `db` will be `undefined` and `doc(db, ...)` throws — guard the effect:

```jsx
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data && data.active) setPricing(data);
    });
    return () => unsub();
  }, []);
```

- [ ] **Step 2: Replace the price display block (old lines 67-73)**

```jsx
                <div className="text-left sm:text-right">
                  <div className="text-sm text-slate-400 dark:text-slate-500 line-through">{fmt(pricing.originalCents)}</div>
                  <div className="text-4xl font-bold">{pricing.installments}x de {fmt(installmentCents)}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    ou {fmt(pricing.totalCents)} à vista · sem juros
                  </div>
                </div>
```

This satisfies Decreto 5.903/2006 by always showing the cash total next to the installment number, never the installment alone.

- [ ] **Step 3: Replace the "50% OFF" badge (old lines 61-65) to use the derived percent and optional campaign label**

```jsx
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200/50 dark:border-rose-800/50">
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {discountPercent}% OFF{pricing.campaignLabel ? ` — ${pricing.campaignLabel}` : ' — Oferta por tempo limitado'}
                    </span>
                  </div>
```

- [ ] **Step 4: Replace the comparison block's hardcoded prices (old lines 90-96)**

```jsx
                <div className="grid grid-cols-[1fr_auto] gap-4 font-semibold text-violet-600 dark:text-violet-400">
                  <span>Realwise (sempre)</span>
                  <div className="text-right">
                    <span className="line-through text-slate-400 dark:text-slate-500 font-normal mr-2">{fmt(pricing.originalCents)}</span>
                    <span>{fmt(pricing.totalCents)}</span>
                  </div>
                </div>
```

- [ ] **Step 5: Update headline/CTA text to match the spec ("Seu, pra sempre.")**

Replace line 37 headline:

```jsx
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Seu, pra sempre.
          </h2>
```

Replace the CTA button text (old line 112, `Assumir o controle`) and its analytics label:

```jsx
              <Button
                size="lg"
                onClick={() => { landingAnalytics.trackCtaClicked('Quero o meu acesso', 'pricing'); onBuy(); }}
                className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
              >
                Quero o meu acesso
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
```

- [ ] **Step 6: Visual check**

`npm run dev`, scroll to pricing, confirm it shows "12x de R$ 19,90" / "ou R$ 238,80 à vista · sem juros" / "50% OFF — Lançamento" (reading from the seeded `config/pricing` doc from Task 1). Toggle `active: false` on the doc via Firebase Console and confirm it falls back to `FALLBACK_PRICING` values without crashing.

- [ ] **Step 7: Commit**

```bash
git add landing_page/components/landing/PricingSection.jsx
git commit -m "feat: read pricing section from config/pricing instead of hardcoded values"
```

---

## Task 13: Checkout — align price to config, trim step 1 to email-only, instant Pix copy

**Files:**
- Modify: `landing_page/components/landing/CheckoutModal.jsx`

- [ ] **Step 1: Replace hardcoded constants with Firestore-backed state**

Replace lines 11-12:

```javascript
// BASE_PRICE / PROMO_PRICE are seeded from Firestore on mount; these are
// only the pre-fetch fallback shown for an instant before config/pricing loads.
const FALLBACK_BASE_PRICE = 479;
const FALLBACK_PROMO_PRICE = 239;
```

Add the Firestore import near the top (after line 5):

```javascript
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
```

In the component, replace the `amount` initial state (line 51) and add two new state vars right after it:

```javascript
  const [amount, setAmount] = useState(FALLBACK_PROMO_PRICE);
  const [basePrice, setBasePrice] = useState(FALLBACK_BASE_PRICE);
  const [promoPrice, setPromoPrice] = useState(FALLBACK_PROMO_PRICE);
```

Add an effect to load it once, near the existing `loadConfig` effect (after line 106):

```javascript
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
```

Then replace every remaining bare `BASE_PRICE` / `PROMO_PRICE` reference in the file (lines 119, 411, 487, 488, 499, 500) with `basePrice` / `promoPrice` respectively — same variable role, now state instead of module constants.

- [ ] **Step 2: Trim step 1 to email-only; move WhatsApp collection to post-payment**

Replace the step-1 form fields (lines 514-532) — drop the name and WhatsApp inputs, keep email and the optional coupon:

```jsx
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
```

Update `handleStep1Submit`'s validation (lines 364-369) to only require email:

```javascript
    const { email } = form;

    if (!email.trim()) {
      setError('Preencha o e-mail.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido.');
      return;
    }
```

And its `fetch` body (lines 384-389) — drop `name`/`whatsapp`, the backend's `createPayment` already tolerates missing `name`/`whatsapp` (see `functions/index.js` lines 219-237: both are optional, only `email` is required):

```javascript
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          couponCode: form.coupon.trim().toUpperCase() || undefined,
          utmSource: landingAnalytics.getUtmSource(),
        }),
```

This is a deliberate, scoped frontend change only — name/WhatsApp are still optional fields the backend already handles; we are not modifying `functions/index.js` for this step. WhatsApp capture is deferred to the `PurchaseSuccess` page in Task 14.

- [ ] **Step 3: Visual check**

`npm run dev`, open checkout modal, confirm step 1 only asks for email + coupon, submitting with a valid email moves to step 2.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/CheckoutModal.jsx
git commit -m "feat: trim checkout step 1 to email-only and read price from config/pricing"
```

---

## Task 14: Honest post-payment copy (no fake 24h promise)

**Files:**
- Modify: `landing_page/pages/PurchaseSuccess.jsx`

- [ ] **Step 1: Read the current file**

Run: `cat landing_page/pages/PurchaseSuccess.jsx`
(Confirms current copy/structure before editing — this file wasn't read during research.)

- [ ] **Step 2: Replace any "configurando seu acesso em 24h" type copy with an honest, WhatsApp-forward message**

Find the success/pending messaging block and replace its body text with:

```jsx
<p>Seu acesso está sendo configurado e chega no seu e-mail. Qualquer coisa, me chama no WhatsApp agora — quem responde sou eu.</p>
```

Add (or reuse, if a WhatsApp link already exists in the file) a link in the same style as `FooterSection.jsx`'s contact link:

```jsx
<a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="underline">
  Falar no WhatsApp
</a>
```

- [ ] **Step 3: Visual check**

`npm run dev`, navigate to `/purchase-success?pending=1` directly, confirm the new copy and WhatsApp link render.

- [ ] **Step 4: Commit**

```bash
git add landing_page/pages/PurchaseSuccess.jsx
git commit -m "feat: replace vague 24h access promise with honest copy and direct WhatsApp link"
```

---

## Task 15: Guarantee section

**Files:**
- Create: `landing_page/components/landing/GuaranteeSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// landing_page/components/landing/GuaranteeSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export default function GuaranteeSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl mx-auto mt-8 px-6"
    >
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/30 p-6 flex items-start gap-4">
        <ShieldCheck className="w-8 h-8 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">30 dias de garantia incondicional.</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Usou e não foi pra você? Devolvo seu dinheiro. Sem perguntar o porquê, sem letra miúda. É só me chamar.
            O risco é meu, não seu. <a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="underline font-medium">suporte@realwise.com.br</a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Mount it in `home.jsx` right after `PricingSection`** (done together with Task 17's reorder — skip a separate visual check here).

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/GuaranteeSection.jsx
git commit -m "feat: add 30-day guarantee section"
```

---

## Task 16: FAQ additions

**Files:**
- Modify: `landing_page/components/landing/FAQSection.jsx`

- [ ] **Step 1: Add 2 new FAQ items**

The existing array (after Task 4's color swap) already has "Preciso conectar meu banco?" and "Vocês acessam minha conta bancária?" — the spec asks for those plus "E se eu não gostar?". Insert this new entry right after the "Diferença para Mobills..." entry (the last one in the array, currently ending the array at the closing `];`):

```javascript
  {
    question: 'E se eu não gostar?',
    answer: '30 dias de garantia incondicional. Devolvo seu dinheiro, sem perguntar o porquê. O risco é meu, não seu.',
  },
```

- [ ] **Step 2: Visual check**

`npm run dev`, scroll to FAQ, confirm the new item appears and expands correctly.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/FAQSection.jsx
git commit -m "feat: add 30-day guarantee FAQ entry"
```

---

## Task 17: Floating WhatsApp button + footer CNPJ (already present) + home.jsx reorder

**Files:**
- Create: `landing_page/components/landing/WhatsAppFloatingButton.jsx`
- Modify: `landing_page/pages/home.jsx`

- [ ] **Step 1: Write the floating button**

```jsx
// landing_page/components/landing/WhatsAppFloatingButton.jsx
import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppFloatingButton() {
  return (
    <a
      href="https://wa.me/5541992310339"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-xl flex items-center justify-center transition-transform hover:scale-110"
    >
      <MessageCircle className="w-7 h-7 text-white" fill="currentColor" />
    </a>
  );
}
```

This uses `emerald` deliberately — WhatsApp's own brand green is a recognizable affordance distinct from the Realwise violet brand, matching how the existing codebase already treats green as a meaning-carrying color (positive amounts) rather than a brand accent.

- [ ] **Step 2: Reorder sections in `home.jsx` per the new funnel and mount new components**

Replace the imports block (lines 2-12) with:

```jsx
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import LiveImportDemo from '../components/landing/LiveImportDemo';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import FounderStory from '../components/landing/FounderStory';
import Testimonials from '../components/landing/Testimonials';
import FeaturesSection from '../components/landing/FeaturesSection';
import PricingSection from '../components/landing/PricingSection';
import GuaranteeSection from '../components/landing/GuaranteeSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import FooterSection from '../components/landing/FooterSection';
import WhatsAppFloatingButton from '../components/landing/WhatsAppFloatingButton';
import CheckoutModal from '../components/landing/CheckoutModal';
import { landingAnalytics } from '../landingAnalytics';
```

Note: `WhyRealwiseSection` is dropped from the funnel — its purpose (justifying the product) is now covered by pain points → demo → privacy → founder story → features, per the spec's funnel in section 1. Don't delete the file, just stop importing/rendering it here in case content from it needs to be salvaged later.

Replace the render block (lines 60-82) with:

```jsx
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <Header onBuy={() => openCheckout('header')} />
      <div className="pt-20">
        <HeroSection onBuy={() => openCheckout('hero')} couponCode={couponCode} />
        <PainPointsSection />
        <LiveImportDemo />
        <DataOwnershipSection />
        <FounderStory />
        <Testimonials />
        <FeaturesSection />
        <PricingSection onBuy={() => openCheckout('pricing')} couponCode={couponCode} />
        <GuaranteeSection />
        <FAQSection />
        <FinalCTASection onBuy={() => openCheckout('final-cta')} />
        <FooterSection />
      </div>
      <WhatsAppFloatingButton />
      <CheckoutModal
        open={checkoutOpen}
        section={checkoutSection}
        onClose={closeCheckout}
        prefill={checkoutPrefill}
      />
    </div>
  );
```

- [ ] **Step 3: Visual check**

`npm run dev`, scroll the whole page top to bottom, confirm the new order: Hero → Pain → Demo → Privacy → Founder → (no testimonials, empty) → Features → Pricing → Guarantee → FAQ → Final CTA → Footer, with the WhatsApp button floating throughout.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/WhatsAppFloatingButton.jsx landing_page/pages/home.jsx
git commit -m "feat: reorder landing sections per new conversion funnel, add floating WhatsApp button"
```

---

## Task 18: Lint + full smoke test

**Files:** none (verification only)

- [ ] **Step 1: Lint**

```bash
npm run lint
```
Expected: no errors. Fix any reported issues before proceeding (most likely unused imports if `WhyRealwiseSection` or old constants were left dangling).

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: build completes without errors.

- [ ] **Step 3: Manual smoke test checklist**

`npm run dev`, then in the browser:
- [ ] Scroll the full landing page in light mode — every CTA says "Quero o meu acesso" and opens the checkout modal.
- [ ] Toggle dark mode — confirm no leftover emerald/teal in hero, pricing, FAQ, features (WhatsApp button and positive-amount demo line staying green is expected, per Tasks 8/17).
- [ ] Open checkout — step 1 asks only for email + coupon; step 2 shows MP Bricks.
- [ ] Run the live-import demo — transactions animate in with categories.
- [ ] Confirm `Testimonials` renders nothing and `VideoSection` renders nothing (no `VITE_FOUNDER_VIDEO_URL` set).
- [ ] Visit `/admin/pricing` as an admin user, change a value, save, refresh the landing page in another tab, confirm the new price appears.
- [ ] Resize to mobile width (375px) — confirm hero, demo, founder story, and pricing card don't overflow or clip.

- [ ] **Step 4: No commit needed** — this task is verification-only. If any check fails, fix in the relevant task's file and commit there.

---

## Self-Review Notes (carried over from plan authoring, not a task to execute)

- Spec coverage: Tasks 1-18 cover spec sections 3.2 (Hero/Task 5), 3.3 (Video/Task 6), 3.4 (Pain/Task 7), 3.5 (Demo/Task 8), 3.6 (Privacy/Task 9), 3.7 (Founder/Task 10), 3.8 (Testimonials/Task 11), 3.10+3.10b (Pricing/Tasks 1-3, 12), 3.11 (Guarantee/Task 15), 3.12 (FAQ/Task 16), 3.13 (Footer+WhatsApp/Task 17), section 5 (checkout friction/Task 13), and the PurchaseSuccess honesty fix (Task 14). Section 3.9 (Features grid) is left content-as-is per spec ("manter, enxugar") — only its color is swapped in Task 4, since its existing copy is already terse (1 line per feature, matching the spec's ask).
- Not in scope per explicit user instruction: recording the video, taking the founder photo, collecting real testimonials, and any `firebase deploy --only hosting` that would actually publish the result — every task ends in a local commit, not a deploy of the live site. Functions/rules deploys in Tasks 1-2 are scoped to backend-only resources (Firestore rules, Cloud Functions) needed for the admin pricing tool to work in development/testing, not a hosting publish.
- Type/naming consistency check: `config/pricing` field names (`originalCents`, `totalCents`, `installments`, `active`, `campaignLabel`) are used identically across Task 1 (seed), Task 2 (function + validation), Task 3 (admin UI), and Task 12 (landing read) — no renames introduced between tasks.
- Performance/SEO (spec section 3.12/Task 12 "prerender") and the A/B headline-variant testing (spec section 8) are intentionally **not** included as tasks — they're measurement/infra decisions the user should make explicitly (which prerender approach, which variants to run) rather than something to silently bake into a content-and-pricing plan. Flag this to the user after the plan is approved.
