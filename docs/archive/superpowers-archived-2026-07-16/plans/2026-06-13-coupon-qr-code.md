# Coupon QR Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sellers get a downloadable QR code poster per coupon; scanning opens the landing page with the coupon pre-applied.

**Architecture:** A new `/promo/:code` path in `main.jsx` renders the landing page with the coupon injected into the existing `checkoutPrefill` flow. A client-side `QRCodeModal` draws the poster on an HTML5 canvas (no new npm packages) and triggers a browser PNG download. The admin coupon table gains a "Gerar QR Code" action.

**Tech Stack:** React 19, HTML5 Canvas API, `api.qrserver.com` (free, no key, CORS-enabled), Tailwind CSS v4.

---

## File Map

| File | Action |
|------|--------|
| `src/main.jsx` | Modify — add `/promo/:code` path detection |
| `landing_page/pages/home.jsx` | Modify — accept `couponCode` prop, seed `checkoutPrefill`, pass to sections |
| `landing_page/components/landing/HeroSection.jsx` | Modify — accept `couponCode` prop, show discount badge when present |
| `landing_page/components/landing/PricingSection.jsx` | Modify — accept `couponCode` prop, show discount badge when present |
| `src/pages/admin/QRCodeModal.jsx` | Create — canvas poster, preview, download, copy URL |
| `src/pages/admin/CouponsPage.jsx` | Modify — add "Gerar QR Code" action + `qrCoupon` state |

---

## Task 1: `/promo/:code` route in `src/main.jsx`

**Files:**
- Modify: `src/main.jsx`

Current `main.jsx` checks `window.location.pathname === '/checkout'` and renders `CheckoutRedirect`, otherwise renders `App`. We need to add a `/promo/` check that renders the landing `Home` with a `couponCode` prop.

- [ ] **Step 1: Add the promo path detection**

Replace the entire `src/main.jsx` with:

```jsx
import { checkBuildHash } from './lib/buildHash'
checkBuildHash()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CheckoutRedirect from './pages/CheckoutRedirect.jsx'
import Home from '../landing_page/pages/home.jsx'

const path = window.location.pathname

function getPromoCode() {
  const match = path.match(/^\/promo\/([^/]+)/)
  return match ? match[1] : null
}

const promoCode = getPromoCode()

if (path === '/checkout') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <CheckoutRedirect />
    </StrictMode>,
  )
} else if (promoCode) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Home couponCode={promoCode} />
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
```

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
npm run dev
```

Expected: server starts at http://localhost:5173 with no compile errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/main.jsx && rtk git commit -m "feat: add /promo/:code route detection in main.jsx"
```

---

## Task 2: Inject coupon into landing page checkout flow

**Files:**
- Modify: `landing_page/pages/home.jsx`

`home.jsx` already has `checkoutPrefill` state. When `couponCode` prop is provided, seed it so the `CheckoutModal` gets it pre-filled automatically.

- [ ] **Step 1: Update `home.jsx` to accept and use `couponCode` prop**

Change the component signature and `checkoutPrefill` initialization. In `landing_page/pages/home.jsx`, replace:

```jsx
export default function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSection, setCheckoutSection] = useState('');
  const [checkoutPrefill, setCheckoutPrefill] = useState({});
```

with:

```jsx
export default function Home({ couponCode = '' }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSection, setCheckoutSection] = useState('');
  const [checkoutPrefill, setCheckoutPrefill] = useState(
    couponCode ? { coupon: couponCode } : {}
  );
```

- [ ] **Step 2: Pass `couponCode` to `HeroSection` and `PricingSection`**

In `landing_page/pages/home.jsx`, replace:

```jsx
        <HeroSection onBuy={() => openCheckout('hero')} />
```

with:

```jsx
        <HeroSection onBuy={() => openCheckout('hero')} couponCode={couponCode} />
```

And replace:

```jsx
        <PricingSection onBuy={() => openCheckout('pricing')} />
```

with:

```jsx
        <PricingSection onBuy={() => openCheckout('pricing')} couponCode={couponCode} />
```

- [ ] **Step 3: Commit**

```bash
rtk git add landing_page/pages/home.jsx && rtk git commit -m "feat: seed checkoutPrefill with coupon from /promo/:code"
```

---

## Task 3: Show coupon badge in HeroSection

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`

When `couponCode` is non-empty, show a visible discount badge above the headline so the user sees their exclusive discount.

- [ ] **Step 1: Add `couponCode` prop and badge**

In `landing_page/components/landing/HeroSection.jsx`, replace:

```jsx
export default function HeroSection({ onBuy }) {
```

with:

```jsx
export default function HeroSection({ onBuy, couponCode = '' }) {
```

Then, immediately after the existing `<div className="inline-flex items-center gap-2 px-4 py-2 mb-8 ...">` badge block (the "Pagamento único · Acesso vitalício" badge), add:

```jsx
          {couponCode && (
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30">
              🎟 Cupom <span className="font-mono tracking-widest">{couponCode}</span> aplicado automaticamente
            </div>
          )}
```

- [ ] **Step 2: Commit**

```bash
rtk git add landing_page/components/landing/HeroSection.jsx && rtk git commit -m "feat: show coupon badge in HeroSection when couponCode prop is set"
```

---

## Task 4: Show coupon badge in PricingSection

**Files:**
- Modify: `landing_page/components/landing/PricingSection.jsx`

- [ ] **Step 1: Add `couponCode` prop and badge**

In `landing_page/components/landing/PricingSection.jsx`, replace:

```jsx
export default function PricingSection({ onBuy }) {
```

with:

```jsx
export default function PricingSection({ onBuy, couponCode = '' }) {
```

Find the pricing card's CTA button area. After the `<h2>` or price display block (before the CTA button), add a coupon indicator. Locate the line that contains the price display (e.g. a div with `text-3xl` font for price), and just before the CTA `<Button>`, insert:

```jsx
                  {couponCode && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-2">
                      🎟 Cupom <span className="font-mono tracking-widest">{couponCode}</span> ativo
                    </div>
                  )}
```

- [ ] **Step 2: Commit**

```bash
rtk git add landing_page/components/landing/PricingSection.jsx && rtk git commit -m "feat: show coupon badge in PricingSection when couponCode prop is set"
```

---

## Task 5: Create `QRCodeModal` component

**Files:**
- Create: `src/pages/admin/QRCodeModal.jsx`

This component draws a 400×600 poster on a hidden canvas, shows a preview `<img>`, and offers download + copy URL.

- [ ] **Step 1: Create the file**

```jsx
import { useEffect, useRef, useState } from 'react';
import { X, Copy, Download } from 'lucide-react';

function formatDiscountLabel(coupon) {
  if (coupon.discountType === 'percentage') return `${coupon.discountValue}% OFF`;
  return `R$ ${(coupon.discountValue / 100).toFixed(2).replace('.', ',')} OFF`;
}

function buildQrUrl(code) {
  const data = encodeURIComponent(`https://realwise.com.br/promo/${code}`);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${data}&size=300x300&bgcolor=111827&color=ffffff&qzone=2`;
}

function drawPoster(canvas, qrImage, coupon) {
  const ctx = canvas.getContext('2d');
  const W = 400;
  const H = 600;
  canvas.width = W;
  canvas.height = H;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(1, '#1f2937');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Logo square
  const squareSize = 40;
  const squareX = W / 2 - squareSize / 2;
  ctx.fillStyle = '#10b981';
  roundRect(ctx, squareX, 44, squareSize, squareSize, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('R', W / 2, 73);

  // Wordmark
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Realwise', W / 2, 108);

  // Discount badge
  const label = formatDiscountLabel(coupon);
  const badgeGrad = ctx.createLinearGradient(0, 130, W, 130);
  badgeGrad.addColorStop(0, '#059669');
  badgeGrad.addColorStop(1, '#10b981');
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 16;
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, 80, 130, 240, 54, 27);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(label, W / 2, 165);

  // Tagline
  ctx.fillStyle = '#9ca3af';
  ctx.font = '15px sans-serif';
  ctx.fillText('Controle suas finanças com', W / 2, 210);
  ctx.fillText('desconto exclusivo', W / 2, 230);

  // QR white card
  const qrSize = 180;
  const qrX = (W - qrSize) / 2;
  const qrY = 258;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 12);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // Coupon code pill
  const code = coupon.code;
  ctx.font = 'bold 18px monospace';
  const textWidth = ctx.measureText(code).width;
  const pillW = Math.max(textWidth + 40, 160);
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = '#1f2937';
  roundRect(ctx, pillX, 466, pillW, 36, 18);
  ctx.fillStyle = '#6ee7b7';
  ctx.letterSpacing = '4px';
  ctx.fillText(code, W / 2, 490);
  ctx.letterSpacing = '0px';

  // Expiry
  if (coupon.validUntil) {
    const d = coupon.validUntil.toDate?.() || new Date(coupon.validUntil);
    const formatted = d.toLocaleDateString('pt-BR');
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Válido até ${formatted}`, W / 2, 534);
  }

  // Bottom URL hint
  ctx.fillStyle = '#4b5563';
  ctx.font = '11px sans-serif';
  ctx.fillText('realwise.com.br', W / 2, 575);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

export default function QRCodeModal({ coupon, onClose }) {
  const canvasRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const promoUrl = `https://realwise.com.br/promo/${coupon.code}`;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawPoster(canvasRef.current, img, coupon);
      setPreviewUrl(canvasRef.current.toDataURL('image/png'));
      setLoading(false);
    };
    img.onerror = () => {
      setError('Não foi possível carregar o QR Code. Verifique sua conexão.');
      setLoading(false);
    };
    img.src = buildQrUrl(coupon.code);
  }, [coupon]);

  function handleDownload() {
    canvasRef.current.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${coupon.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(promoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">QR Code — {coupon.code}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden canvas for drawing */}
        <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px' }} />

        {loading && (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 dark:text-red-400 py-8">
            <p className="mb-3 text-sm">{error}</p>
            <button
              onClick={() => { setError(''); setLoading(true); }}
              className="text-sm text-emerald-600 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && previewUrl && (
          <>
            <img
              src={previewUrl}
              alt="QR Code poster preview"
              className="w-full rounded-xl mb-4 border border-gray-200 dark:border-gray-700"
            />

            {/* Promo URL row */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <span className="flex-1 text-xs text-gray-600 dark:text-gray-300 font-mono truncate">
                {promoUrl}
              </span>
              <button
                onClick={handleCopy}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex-shrink-0"
                title="Copiar URL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 text-center -mt-2 mb-3">URL copiada!</p>}

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar PNG
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/pages/admin/QRCodeModal.jsx && rtk git commit -m "feat: add QRCodeModal with canvas poster, preview and download"
```

---

## Task 6: Wire "Gerar QR Code" into `CouponsPage`

**Files:**
- Modify: `src/pages/admin/CouponsPage.jsx`

- [ ] **Step 1: Import `QRCodeModal` at the top of `CouponsPage.jsx`**

After the existing imports, add:

```jsx
import QRCodeModal from './QRCodeModal';
```

- [ ] **Step 2: Add `qrCoupon` state**

Inside the `CouponsPage` component function, after the existing state declarations (after `const [editingCoupon, setEditingCoupon] = useState(null);`), add:

```jsx
  const [qrCoupon, setQrCoupon] = useState(null);
```

- [ ] **Step 3: Add "Gerar QR Code" button to the action cell**

In the `<td>` that contains the `<div className="flex gap-2">` with "Editar" and "Desabilitar/Habilitar" buttons, add a third button:

```jsx
                      <button
                        onClick={() => setQrCoupon(coupon)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Gerar QR
                      </button>
```

Place it after the "Desabilitar/Habilitar" button.

- [ ] **Step 4: Render `QRCodeModal` below the existing `{showModal && ...}` block**

After:

```jsx
      {showModal && (
        <CreateEditCouponModal
          ...
        />
      )}
```

Add:

```jsx
      {qrCoupon && (
        <QRCodeModal coupon={qrCoupon} onClose={() => setQrCoupon(null)} />
      )}
```

- [ ] **Step 5: Verify in the browser**

Run `npm run dev`, navigate to the admin coupons page, click "Gerar QR" on any coupon, verify:
- Modal opens with a loading spinner
- Poster preview renders (dark background, logo, badge, QR image, code pill)
- "Baixar PNG" downloads `qr-COUPONCODE.png`
- Copy button copies the promo URL

- [ ] **Step 6: Commit**

```bash
rtk git add src/pages/admin/CouponsPage.jsx && rtk git commit -m "feat: add Gerar QR Code action in CouponsPage"
```

---

## Task 7: Smoke-test the `/promo/:code` route

Manual verification only (no unit tests — this is pure routing + canvas rendering).

- [ ] **Step 1: Navigate to `http://localhost:5173/promo/SPRING50`**

Expected:
- Landing page renders (not the tenant app)
- Emerald badge showing "🎟 Cupom SPRING50 aplicado automaticamente" appears in HeroSection
- Coupon indicator appears near pricing CTA in PricingSection
- Clicking any CTA opens `CheckoutModal` with the coupon field pre-filled with `SPRING50`

- [ ] **Step 2: Navigate to `http://localhost:5173/promo/`** (missing code)

Expected: normal landing page with no coupon badge (regex requires at least one char after `/promo/`).

- [ ] **Step 3: Commit**

No code changes in this task — this is verification only. If issues found, fix them and commit with:

```bash
rtk git commit -m "fix: <describe the fix>"
```
