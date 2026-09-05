# Realwise Rebrand & Domain Migration — Design

**Date:** 2026-05-01
**Status:** Approved (proceeding with stated assumptions)

## Overview

Rebrand the product from "Moneywise" / "Limas Finance" / "Blim" to **Realwise**, migrate to the new domain `realwise.com.br`, switch the tenant URL scheme from path-based (`moneywise.web.app/{clientId}/dashboard`) to **subdomain-based** (`{clientId}.realwise.com.br/dashboard`), and move outbound email to `contato@realwise.com.br`.

The underlying Firebase project (`moneywise-ad9ec`) and per-client Firebase projects are kept as-is — only branding, domain, and hosting bindings change. No Firestore data migration.

---

## 1. Assumptions

1. `realwise.com.br` is registered at registro.br and DNS is editable but not yet pointing anywhere.
2. `contato@realwise.com.br` is hosted on **Umbler** (mailbox already provisioned). Nodemailer connects via Umbler's SMTP (`smtp.umbler.com`, port 587, STARTTLS) using the mailbox password. No Google Workspace involved.
3. Firebase project `moneywise-ad9ec` remains the hosting project and is **not renamed** (Firebase project IDs are immutable). All client Firebase projects remain unchanged.
4. URL layout:
   - `realwise.com.br` (apex) → marketing landing page
   - `app.realwise.com.br/login` → shared/no-tenant entry (login, signup, post-purchase)
   - `{clientId}.realwise.com.br/dashboard` → tenant app
5. Old `moneywise.web.app/{clientId}/*` URLs 301-redirect to `{clientId}.realwise.com.br/*` via a tiny redirect shim hosted on the old site.
6. The local repo folder may be renamed `limas-finance` → `realwise` (cosmetic, optional).

---

## 2. Architecture Changes

### 2.1 Tenant Detection (path → subdomain)

**Current** (`src/config/clientConfig.js`):
```js
export function extractClientId(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] || null;
}
```

**New**:
```js
export function extractClientId(hostname) {
  // Strip port if present
  const host = hostname.split(':')[0];
  const parts = host.split('.');
  // Reserved subdomains and apex are not tenants
  const RESERVED = new Set(['app', 'www', 'realwise', 'localhost']);
  const first = parts[0];
  if (parts.length < 3 && host !== 'localhost') return null; // apex
  if (RESERVED.has(first)) return null;
  return first;
}
```

- Caller switches from `extractClientId(window.location.pathname)` to `extractClientId(window.location.hostname)`.
- `src/App.jsx` drops `basename={...}` — routes now sit at `/`.
- `ClientConfigContext` behavior unchanged otherwise; still fetches `/clients/{id}.json`.
- Local dev: Vite serves `*.localhost` automatically on macOS/Chrome/Firefox. Test via `http://jonathalimax.localhost:5173/dashboard`.

### 2.2 Hosting & DNS

**Firebase Hosting** (project `moneywise-ad9ec`, site `mymoneywise` — kept; we add the new domain to it):

- Add custom domain `realwise.com.br` (apex)
- Add custom domain `*.realwise.com.br` (wildcard — Firebase issues wildcard SSL)
- Add custom domain `app.realwise.com.br` if wildcard doesn't auto-cover it (Firebase wildcards usually cover all subdomains)

**DNS records** (registro.br or Cloudflare in front):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `@` | (Firebase IPs) | Apex landing |
| A | `*` | (Firebase IPs) | Wildcard tenants |
| TXT | `@` | (Firebase verify token) | Domain verification |
| MX | `@` | Umbler MX records (from Umbler panel) | Email |
| TXT | `@` | SPF: `v=spf1 include:_spf.umbler.com ~all` (confirm exact value in Umbler panel) | Email auth |
| TXT | `umbler._domainkey` (or as instructed) | DKIM record from Umbler panel | Email auth |

### 2.3 Email Sender

- New / updated secrets (Firebase Secret Manager):
  - `EMAIL_USER=contato@realwise.com.br`
  - `EMAIL_PASSWORD=<umbler mailbox password>`
  - `EMAIL_HOST=smtp.umbler.com` (confirm exact host in Umbler panel)
  - `EMAIL_PORT=587`
- Nodemailer transport in `functions/index.js` switches from the Gmail preset to explicit SMTP:
  ```js
  nodemailer.createTransport({
    host: EMAIL_HOST.value(),
    port: Number(EMAIL_PORT.value()),
    secure: false,            // STARTTLS on 587
    auth: { user: EMAIL_USER.value(), pass: EMAIL_PASSWORD.value() }
  })
  ```
- All Nodemailer `from:` lines updated to `Realwise <contato@realwise.com.br>`.
- Email templates (`functions/emailTemplates.js`) re-branded: logo text, footer, "Moneywise" → "Realwise", any in-template URL → `https://realwise.com.br`.

### 2.4 OAuth Authorized Domains

For **each** client Firebase project (`limas-finance`, `carloscalzadillar`'s project, `palomabandeiramatos5`'s project, `app`'s project), in Firebase Console → Authentication → Settings → Authorized domains, add:
- `realwise.com.br`
- `app.realwise.com.br`
- The specific tenant subdomain in use (Firebase requires explicit entries; wildcards are not supported here — each tenant subdomain that signs in via that project must be listed)

OAuth consent screen branding (GCP console) updated per project: app name → "Realwise", logo, support email → `contato@realwise.com.br`.

### 2.5 Old-Domain Redirect Shim

Keep `mymoneywise.web.app` (and any other current preview URLs) live with a one-page redirect:

```html
<script>
  const m = location.pathname.match(/^\/([^/]+)(\/.*)?$/);
  const tenant = m ? m[1] : 'app';
  const rest = m && m[2] ? m[2] : '/';
  location.replace(`https://${tenant}.realwise.com.br${rest}${location.search}${location.hash}`);
</script>
```

Deploy this as a separate Firebase Hosting site target `legacy-redirect` so it doesn't conflict with the rebranded production site.

---

## 3. Code Rename Pass

Global text replacement across the repo (excluding `node_modules`, `dist`, `.firebase/`):

| From | To |
|------|----|
| `Moneywise` | `Realwise` |
| `MoneyWise` | `Realwise` |
| `moneywise` | `realwise` |
| `Limas Finance` | `Realwise` |
| `limasfinance` | `realwise` |
| `limas-finance` | `realwise` (in user-facing strings only — see exception below) |
| `Blim` / `blim` | `Realwise` / `realwise` |
| `moneywise.web.app` | `realwise.com.br` (or `app.realwise.com.br` for login flows) |

**Exceptions (do NOT rename)**:
- `.firebaserc` alias `jonathalimax → limas-finance` — this is an immutable Firebase project ID. Leave it.
- `firebase.json` `"site": "mymoneywise"` — leave for now; renaming a hosting site is decoupled from the domain. Optionally add a new site `realwise` and deploy there in a follow-up.
- `package.json` `"name"` field — rename to `realwise` (local only, no npm publish impact).

**Files touched** (~50, full list to be enumerated in implementation plan): `index.html`, `package.json`, `landing_page/**`, `src/components/landing/**`, `src/components/Sidebar.jsx`, `src/components/Dashboard.jsx`, `src/components/SettingsModal.jsx`, `src/components/TutorialModal.jsx`, `src/components/WhatsAppButton.jsx`, `src/contexts/AccessContext.jsx`, `src/pages/Help.jsx`, `src/pages/SharedLogin.jsx`, `src/pages/admin/*`, `functions/emailTemplates.js`, `functions/sendAdminEmail.js`, `functions/index.js`, `functions/createCheckoutSession.js`, `functions/createDiscountCheckout.js`, `functions/stripeWebhook.js`, `functions/transferClient.js`, `functions/onboardUser.js`, `functions/aiService.js`, `functions/importProcessor.js`, `scripts/onboard-user.cjs`, `scripts/reset-user-data.js`.

### 3.1 Hardcoded URL Updates

- Stripe `success_url` / `cancel_url` in `createCheckoutSession.js` and `createDiscountCheckout.js` → `https://app.realwise.com.br/...` (or `{clientId}` interpolation if already templated).
- Email template links → `https://realwise.com.br` / `https://{clientId}.realwise.com.br/...`.
- Landing page CTA links and footer.

### 3.2 Test Updates

- `src/config/clientConfig.test.js` — rewrite tests to feed hostname strings instead of pathnames; cover apex, `app.`, `www.`, wildcard tenant, `localhost`, `*.localhost`.
- `src/config/onboardingSteps.test.js` and `rendaCalc.test.js` — unaffected.

---

## 4. Local Development

Update `README.md` with:
- Dev server still runs on `http://localhost:5173`
- Tenant testing via `http://{clientId}.localhost:5173/dashboard` (works in modern browsers without `/etc/hosts`)
- Shared login: `http://app.localhost:5173/login`
- For browsers that don't resolve `*.localhost`, add `/etc/hosts` entries.

---

## 5. External Service Updates (manual, by user)

| Service | Action |
|---------|--------|
| registro.br DNS | Add A, wildcard A, MX (Umbler), SPF, DKIM, TXT verification |
| Firebase Hosting console | Add custom domains `realwise.com.br`, `*.realwise.com.br` |
| Each client Firebase project | Add authorized domains; update OAuth consent screen |
| Umbler panel | Confirm `contato@realwise.com.br` mailbox exists; copy SMTP host + DKIM/SPF records |
| Firebase secrets | `firebase functions:secrets:set EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT` |
| Stripe Dashboard | Update webhook endpoint if pointed at hosting domain (cloud-functions URLs unchanged) |
| Meta WhatsApp Cloud | Update webhook URL if pointed at hosting domain |

---

## 6. Cutover Order

1. **DNS & mailbox** (slow propagation — start first): grab Umbler MX/SPF/DKIM values, add to registro.br DNS along with Firebase A/wildcard records.
2. **Firebase Hosting custom domains**: verify and provision SSL.
3. **Code rebrand PR**: rename pass + subdomain routing on `feat/realwise-rebrand` branch; merge after review.
4. **Deploy preview**: smoke test one tenant subdomain end-to-end (login, dashboard, bills, email send).
5. **OAuth authorized domains**: add across all client Firebase projects.
6. **Email secrets**: rotate `EMAIL_USER` / `EMAIL_PASSWORD`; redeploy functions; trigger a test reminder.
7. **Stripe / WhatsApp webhook URLs**: update if hosting-bound.
8. **Redirect shim** deployed to legacy hosting site.
9. **Cutover announcement** to existing tenants.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wildcard SSL provisioning fails | Firebase issues wildcards via Let's Encrypt; if it fails, fall back to per-tenant explicit subdomain entries |
| OAuth domain mismatch breaks login | Add authorized domains BEFORE cutover; test on staging subdomain |
| Email deliverability drops with new sender | Configure SPF + DKIM correctly; warm up by sending test reminders before cutover |
| Existing user bookmarks 404 | Redirect shim on old domain handles `/{clientId}/*` → subdomain |
| Forgotten "Moneywise" string in image asset | Manual visual QA pass on landing page + dashboard before cutover |

---

## 8. Out of Scope

- Migrating Firestore data to a new Firebase project.
- Renaming the Firebase project ID.
- Changing the per-client Firebase project IDs.
- Internationalization changes (no copy beyond brand name).
- Pricing or feature changes.
