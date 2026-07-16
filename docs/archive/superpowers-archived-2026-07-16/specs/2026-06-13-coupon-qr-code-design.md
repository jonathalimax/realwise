# Coupon QR Code — Design Spec

**Date:** 2026-06-13  
**Status:** Approved

## Overview

Sellers receive a downloadable QR code poster for each coupon. Scanning the QR code opens the Realwise landing page with the coupon pre-applied when the user taps any CTA. The poster is generated entirely client-side — no backend changes required.

---

## 1. Routing — `/promo/:code`

A new route `realwise.com.br/promo/:code` is added to the landing page.

- **Where:** `src/main.jsx` — detect `/promo/` prefix alongside the existing `/checkout` check, extract the code segment, and pass it into the landing page render
- **Behavior:** The extracted coupon code is stored in state and passed as a prop to `HeroSection` and `PricingSection`. All CTA buttons that open checkout include `?coupon=CODE` in their params so the code is pre-filled without user action
- **Fallback:** If the code segment is missing or the URL is just `/`, normal landing page behavior with no coupon

---

## 2. QR Code Generation — Client-Side Only

**No new npm packages. No backend changes. No Firebase Storage writes.**

### QR image source

```
https://api.qrserver.com/v1/create-qr-code/?data=https://realwise.com.br/promo/CODE&size=300x300&bgcolor=111827&color=ffffff&qzone=2
```

Free, no API key, returns a PNG. The dark background (`bgcolor=111827`) matches the poster theme so the QR blends naturally.

### Canvas composition

Canvas size: **400×600px** (portrait). Layers drawn in order:

| Layer | Content | Style |
|-------|---------|-------|
| Background | Full canvas fill | Gradient `#111827` → `#1f2937` |
| Logo | Emerald rounded square + "R" + "Realwise" wordmark | White text, `#10b981` square |
| Discount badge | `"50% OFF"` or `"R$ X,XX OFF"` | Emerald gradient pill with glow shadow |
| Tagline | `"Controle suas finanças com desconto exclusivo"` | `#9ca3af`, centered |
| QR code | PNG from api.qrserver.com, white-padded card | Centered, ~180×180px |
| Coupon code | e.g. `SPRING50` | White monospace, letter-spaced, emerald-tinted dark pill |
| Expiry | `"Válido até DD/MM/YYYY"` | `#6b7280`, omitted if no `validUntil` |

### Download

- Canvas renders off-screen (`position: absolute; left: -9999px`)
- Modal shows `<img src={canvas.toDataURL('image/png')}>` as preview
- "Baixar PNG" button calls `canvas.toBlob()` → triggers browser download as `qr-CODE.png`

---

## 3. Admin UI — `CouponsPage.jsx`

**Only file changed in the admin.**

### Action menu addition

Each coupon row's action menu gains a **"Gerar QR Code"** item. Shown for all coupons regardless of status (admin may want a QR for a disabled coupon to prepare ahead of time).

### State

One new state variable in `CouponsPage`:

```js
const [qrCoupon, setQrCoupon] = useState(null);
```

Modal renders: `{qrCoupon && <QRCodeModal coupon={qrCoupon} onClose={() => setQrCoupon(null)} />}`

### `QRCodeModal` component

Lives in `src/pages/admin/QRCodeModal.jsx`. Props:

```ts
{ coupon: { id, code, discountType, discountValue, validUntil }, onClose: () => void }
```

Responsibilities:
1. On mount: fetch QR PNG from api.qrserver.com via `new Image()`, then draw full poster onto hidden `<canvas>`
2. Convert canvas to data URL → display as `<img>` preview inside modal
3. Show read-only promo URL (`https://realwise.com.br/promo/CODE`) with copy button
4. "Baixar PNG" button triggers download
5. Loading state while QR image fetches; error state if fetch fails (CORS or network)

### Discount label logic

```js
function formatDiscountLabel(coupon) {
  if (coupon.discountType === 'percentage') return `${coupon.discountValue}% OFF`;
  return `R$ ${(coupon.discountValue / 100).toFixed(2).replace('.', ',')} OFF`;
}
```

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/main.jsx` | Add `/promo/:code` route detection, pass code to landing page |
| `src/components/landing/HeroSection.jsx` | Accept `couponCode` prop, append to checkout CTA params |
| `src/components/landing/PricingSection.jsx` | Accept `couponCode` prop, append to checkout CTA params |
| `src/pages/admin/CouponsPage.jsx` | Add "Gerar QR Code" action + `qrCoupon` state + modal render |
| `src/pages/admin/QRCodeModal.jsx` | New component — poster canvas, preview, download, copy URL |

**No changes to:** Cloud Functions, Firestore schema, Firebase Storage, `CouponsPanel.jsx`, or any other file.

---

## 5. Edge Cases

- **CORS on QR fetch:** `api.qrserver.com` supports CORS — `new Image()` with `crossOrigin = 'anonymous'` handles it. If it fails, show an error with a "Tentar novamente" button.
- **No `validUntil`:** Expiry line is simply omitted from the canvas.
- **Long coupon codes:** Canvas text is measured and font size reduced if the code exceeds the pill width.
- **Fixed vs percentage discount:** Badge text adapts via `formatDiscountLabel()`.
