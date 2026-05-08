# Realwise Rebrand & Domain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product from "Moneywise/Limas Finance/Blim" to "Realwise", switch tenant URLs from path-based to subdomain-based, and swap email transport from Gmail to Umbler SMTP.

**Architecture:** `extractClientId` reads `window.location.hostname` instead of `pathname`; `BrowserRouter` drops the `basename` prop so all routes sit at `/`. A code-wide text replacement pass updates all brand strings. Email functions swap `service: 'gmail'` for explicit Umbler SMTP host/port with two new secrets.

**Tech Stack:** React 19, Vite, Firebase Hosting, Nodemailer, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/config/clientConfig.js` | Rewrite `extractClientId` to read hostname |
| `src/config/clientConfig.test.js` | Rewrite all `extractClientId` tests for hostname inputs |
| `src/contexts/ClientConfigContext.jsx` | Switch two `extractClientId(window.location.pathname)` → `hostname` |
| `src/App.jsx` | Drop `basename` prop; update `extractClientId` call and comment |
| `functions/index.js` | Swap Gmail transport → Umbler SMTP; add `EMAIL_HOST`/`EMAIL_PORT` secrets; rename brand strings |
| `functions/sendAdminEmail.js` | Same transport swap + brand rename |
| `functions/emailTemplates.js` | Replace all "Moneywise" → "Realwise" and `moneywise.web.app` → `realwise.com.br` |
| `functions/createCheckoutSession.js` | Replace `mymoneywise.web.app` → `realwise.com.br` in Stripe URLs; fix subdomain routing |
| `functions/createDiscountCheckout.js` | Same URL swap |
| `index.html` | `<title>` tag |
| `package.json` | `"name"` field |
| `landing_page/components/landing/Header.jsx` | Brand name |
| `landing_page/components/landing/HeroSection.jsx` | Brand name in copy |
| `landing_page/components/landing/WhyMoneywiseSection.jsx` | Brand name (and possibly filename) |
| `landing_page/components/landing/FAQSection.jsx` | Brand name in copy |
| `landing_page/components/landing/FooterSection.jsx` | Brand name + domain URL |
| `landing_page/pages/home.jsx` | Brand name |
| `landing_page/pages/PurchaseSuccess.jsx` | Brand name |
| `landing_page/pages/support.jsx` | Brand name |
| `landing_page/pages/FeatureRequest.jsx` | Brand name |
| `landing_page/pages/donations.jsx` | Brand name |
| `src/components/Sidebar.jsx` | "Moneywise" text in sidebar header |
| `src/components/Dashboard.jsx` | Any brand string |
| `src/components/SettingsModal.jsx` | Any brand string |
| `src/components/TutorialModal.jsx` | Any brand string |
| `src/components/WhatsAppButton.jsx` | Any brand string |
| `src/components/landing/Header.jsx` | Brand name |
| `src/components/landing/HeroSection.jsx` | Brand name |
| `src/components/landing/FooterSection.jsx` | Brand name + domain |
| `src/contexts/AccessContext.jsx` | Any brand string |
| `src/pages/Help.jsx` | Brand name |
| `src/pages/SharedLogin.jsx` | Brand name |
| `src/pages/admin/TransferScript.jsx` | Brand name |
| `src/pages/admin/AdminApp.jsx` | Brand name |
| `scripts/onboard-user.cjs` | Brand name |
| `scripts/reset-user-data.js` | Brand name |
| `README.md` | Brand name + dev URL instructions |
| `public/redirect/index.html` | New file — legacy redirect shim |
| `firebase.json` | New `legacy-redirect` hosting target |
| `CLAUDE.md` | Update product name + domain |

---

### Task 1: Rewrite `extractClientId` for subdomain routing

**Files:**
- Modify: `src/config/clientConfig.js`
- Modify: `src/config/clientConfig.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the entire content of `src/config/clientConfig.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractClientId, fetchClientConfig, buildDevConfig } from './clientConfig';

describe('extractClientId', () => {
  it('extracts subdomain from a tenant hostname', () => {
    expect(extractClientId('jonathalimax.realwise.com.br')).toBe('jonathalimax');
  });

  it('extracts subdomain from a tenant hostname with port', () => {
    expect(extractClientId('jonathalimax.localhost:5173')).toBe('jonathalimax');
  });

  it('returns null for apex domain', () => {
    expect(extractClientId('realwise.com.br')).toBeNull();
  });

  it('returns null for www subdomain', () => {
    expect(extractClientId('www.realwise.com.br')).toBeNull();
  });

  it('returns null for app subdomain', () => {
    expect(extractClientId('app.realwise.com.br')).toBeNull();
  });

  it('returns null for bare localhost', () => {
    expect(extractClientId('localhost')).toBeNull();
  });

  it('returns null for bare localhost with port', () => {
    expect(extractClientId('localhost:5173')).toBeNull();
  });

  it('extracts tenant from *.localhost for local dev', () => {
    expect(extractClientId('jonathalimax.localhost:5173')).toBe('jonathalimax');
  });
});

describe('fetchClientConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON when response is ok', async () => {
    const mockConfig = { clientName: 'Test', firebase: {}, features: {} };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockConfig),
    }));
    const result = await fetchClientConfig('testclient');
    expect(result).toEqual(mockConfig);
    expect(fetch).toHaveBeenCalledWith('/clients/testclient.json');
  });

  it('throws with client ID and status when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    await expect(fetchClientConfig('unknown')).rejects.toThrow('Config not found for client: unknown (404)');
  });
});

describe('buildDevConfig', () => {
  it('returns an object with firebase keys and features shape', () => {
    const config = buildDevConfig();
    expect(config).toHaveProperty('clientName');
    expect(config).toHaveProperty('firebase');
    expect(config).toHaveProperty('features');
    const firebaseKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    firebaseKeys.forEach(key => expect(config.firebase).toHaveProperty(key));
    const featureKeys = ['investments', 'b3Sync', 'whatsapp', 'goals', 'salaryBreakdown'];
    featureKeys.forEach(key => expect(config.features).toHaveProperty(key));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/config/clientConfig.test.js
```

Expected: tests for `extractClientId` fail because the current implementation reads `pathname`.

- [ ] **Step 3: Rewrite `extractClientId` in `src/config/clientConfig.js`**

Replace the top section (lines 1–13):

```js
const RESERVED = new Set(['app', 'www', 'realwise', 'localhost']);

/**
 * Extracts the client identifier from the hostname.
 * e.g. 'jonathalimax.realwise.com.br' → 'jonathalimax'
 * e.g. 'jonathalimax.localhost:5173'  → 'jonathalimax'
 * Returns null for apex, reserved subdomains, and bare localhost.
 */
export function extractClientId(hostname) {
  const host = hostname.split(':')[0]; // strip port
  const parts = host.split('.');
  const first = parts[0];
  if (RESERVED.has(first)) return null;
  if (parts.length < 2) return null; // bare single label (shouldn't happen in prod)
  return first;
}
```

Keep `fetchClientConfig` and `buildDevConfig` unchanged.

- [ ] **Step 4: Run tests — all must pass**

```bash
npx vitest run src/config/clientConfig.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/clientConfig.js src/config/clientConfig.test.js
git commit -m "feat: switch extractClientId from pathname to subdomain hostname"
```

---

### Task 2: Wire subdomain extraction into `ClientConfigContext` and `App`

**Files:**
- Modify: `src/contexts/ClientConfigContext.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update `ClientConfigContext.jsx`**

Replace both `window.location.pathname` references (lines 18 and 21):

```js
// Before
const clientId = extractClientId(window.location.pathname);
cfg = await fetchClientConfig(clientId);
// ...
const clientId = import.meta.env.DEV ? 'dev' : extractClientId(window.location.pathname);

// After
const clientId = extractClientId(window.location.hostname);
cfg = await fetchClientConfig(clientId);
// ...
const clientId = import.meta.env.DEV ? 'dev' : extractClientId(window.location.hostname);
```

The full `load()` function should look like:

```js
async function load() {
  try {
    let cfg;
    if (import.meta.env.DEV) {
      cfg = buildDevConfig();
    } else {
      const clientId = extractClientId(window.location.hostname);
      cfg = await fetchClientConfig(clientId);
    }
    const clientId = import.meta.env.DEV ? 'dev' : extractClientId(window.location.hostname);
    await initializeFirebase(cfg.firebase, clientId);
    setConfig(cfg);
  } catch (err) {
    console.error('[ClientConfig] Failed to load config:', err);
    setError(err.message);
  }
}
```

- [ ] **Step 2: Update `App.jsx`**

At line 229, `extractClientId` is called to compute the `basename` for `BrowserRouter`. Switch the call and drop the `basename` prop:

```jsx
// Remove this line entirely:
// const clientId = extractClientId(window.location.pathname);

// Replace the BrowserRouter block (lines 231–238):
return (
  <ClientConfigProvider>
    <PWAInstallProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </PWAInstallProvider>
  </ClientConfigProvider>
);
```

Also update the comment on line 153 from `"/{clientId}/... pattern"` to `"subdomain-based pattern"`:

```jsx
// FirebaseAuthHandler handles /__/auth/handler popup — same logic as before,
// kept outside BrowserRouter because the auth handler URL doesn't follow the
// subdomain-based routing pattern and must match the absolute path.
```

- [ ] **Step 3: Run existing test suite to verify nothing broke**

```bash
npx vitest run src/
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/ClientConfigContext.jsx src/App.jsx
git commit -m "feat: drop basename, wire hostname-based tenant detection into app bootstrap"
```

---

### Task 3: Brand rename pass — frontend source files

**Files:** `index.html`, `package.json`, `src/components/Sidebar.jsx`, and all files listed under §3 of the spec that contain "Moneywise", "Limas Finance", or "Blim".

- [ ] **Step 1: Run the rename pass**

```bash
# Moneywise → Realwise (case-preserving)
find . \
  -not -path './node_modules/*' \
  -not -path './dist/*' \
  -not -path './.firebase/*' \
  -not -path './.git/*' \
  -not -name '*.firebaserc' \
  \( -name '*.js' -o -name '*.jsx' -o -name '*.html' -o -name '*.json' -o -name '*.md' -o -name '*.cjs' \) \
  -exec sed -i '' \
    -e 's/Moneywise/Realwise/g' \
    -e 's/MoneyWise/Realwise/g' \
    -e 's/moneywise/realwise/g' \
    -e 's/Limas Finance/Realwise/g' \
    -e 's/limasfinance/realwise/g' \
    -e 's/Blim/Realwise/g' \
    -e 's/blim/realwise/g' \
  {} +
```

- [ ] **Step 2: Fix exceptions — restore `.firebaserc`**

The above touched `.firebaserc` (which contains the immutable project ID `limas-finance`). Restore it:

```bash
git checkout -- .firebaserc
```

Verify it's back to the original:
```bash
cat .firebaserc
```
Expected: `"jonathalimax": "limas-finance"` unchanged.

- [ ] **Step 3: Fix `package.json` name field (rename only this one intentionally)**

`package.json` `"name"` should be `realwise` — the sed pass already did this. Verify:

```bash
grep '"name"' package.json
```
Expected: `"name": "realwise"` (or leave `"name": "limas-finance"` if it was already renamed — the field is local-only).

- [ ] **Step 4: Fix `firebase.json` site name (do NOT rename)**

The sed pass may have changed `"site": "mymoneywise"` to `"site": "myrealwise"`. Restore the site name to keep the existing hosting site working:

```bash
grep '"site"' firebase.json
```

If it was changed, restore:
```bash
# Edit firebase.json and set "site": "mymoneywise" back
```

- [ ] **Step 5: Verify `src/components/Sidebar.jsx` brand string**

```bash
grep -n "Realwise\|Moneywise" src/components/Sidebar.jsx
```

Expected: only "Realwise" appears (the sidebar header previously showed "Moneywise").

- [ ] **Step 6: Run tests to confirm no logic was broken**

```bash
npx vitest run src/
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -u
git add src/ landing_page/ index.html package.json
git commit -m "feat: rename Moneywise → Realwise across all frontend source files"
```

---

### Task 4: Brand rename pass — functions

**Files:** `functions/index.js`, `functions/sendAdminEmail.js`, `functions/emailTemplates.js`, `functions/createCheckoutSession.js`, `functions/createDiscountCheckout.js`, `functions/onboardUser.js`, `functions/importProcessor.js`, `functions/transferClient.js`, `functions/aiService.js`, `scripts/onboard-user.cjs`, `scripts/reset-user-data.js`

- [ ] **Step 1: Run rename inside functions/**

```bash
find functions/ scripts/ \
  -not -path '*/node_modules/*' \
  \( -name '*.js' -o -name '*.json' -o -name '*.cjs' \) \
  -exec sed -i '' \
    -e 's/Moneywise/Realwise/g' \
    -e 's/MoneyWise/Realwise/g' \
    -e 's/moneywise/realwise/g' \
    -e 's/Limas Finance/Realwise/g' \
    -e 's/limasfinance/realwise/g' \
  {} +
```

- [ ] **Step 2: Verify functions/package.json `"name"` field didn't break**

```bash
grep '"name"' functions/package.json
```

The functions `package.json` `"name"` field (if it contained "moneywise") is local only — rename is fine.

- [ ] **Step 3: Fix hardcoded domain URLs**

The sed pass changed `moneywise.web.app` → `realwise.web.app`. That's wrong — it must become `realwise.com.br`. Fix manually:

```bash
grep -rn "realwise.web.app" functions/ scripts/
```

For every match, replace `realwise.web.app` with `realwise.com.br`:

```bash
find functions/ scripts/ \
  -not -path '*/node_modules/*' \
  \( -name '*.js' -o -name '*.cjs' \) \
  -exec sed -i '' \
    -e 's/realwise\.web\.app/realwise.com.br/g' \
  {} +
```

- [ ] **Step 4: Update Stripe URLs in `createCheckoutSession.js`**

Open `functions/createCheckoutSession.js`. The `success_url` and `cancel_url` currently reference `mymoneywise.web.app/{clientId}/...` (path-based). Update to subdomain-based:

```js
// Replace lines 87-92 with:
success_url: clientId && clientId !== 'app'
  ? `https://${clientId}.realwise.com.br/purchase-success`
  : 'https://app.realwise.com.br/purchase-success',
cancel_url: clientId && clientId !== 'app'
  ? `https://${clientId}.realwise.com.br/`
  : 'https://app.realwise.com.br/',
```

- [ ] **Step 5: Update Stripe URLs in `createDiscountCheckout.js`**

```js
// Replace lines 70-71 with:
success_url: 'https://app.realwise.com.br/purchase-success',
cancel_url: 'https://app.realwise.com.br/',
```

- [ ] **Step 6: Update admin email address in `functions/index.js`**

Line 71 has `jonathalimax@gmail.com` as the admin notification recipient. This is intentional (it's YOUR inbox) — leave it unchanged. Verify only brand strings changed:

```bash
grep -n "jonathalimax@gmail" functions/index.js
```

Expected: still present.

- [ ] **Step 7: Commit**

```bash
git add functions/ scripts/
git commit -m "feat: rename Moneywise → Realwise across functions and fix domain URLs"
```

---

### Task 5: Swap email transport from Gmail to Umbler SMTP

**Files:**
- Modify: `functions/index.js`
- Modify: `functions/sendAdminEmail.js`

- [ ] **Step 1: Add new secrets to `functions/index.js`**

At the top of `functions/index.js` (lines 5-6), add two more secret definitions:

```js
const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');
const emailHostSecret = defineSecret('EMAIL_HOST');
const emailPortSecret = defineSecret('EMAIL_PORT');
```

- [ ] **Step 2: Replace `getEmailTransporter` in `functions/index.js`**

The current function (lines 33–51) uses `service: 'gmail'`. Replace with Umbler SMTP:

```js
const getEmailTransporter = () => {
  try {
    const user = emailUserSecret.value();
    const pass = emailPasswordSecret.value();
    const host = emailHostSecret.value() || 'smtp.umbler.com';
    const port = Number(emailPortSecret.value() || 587);

    if (!user || !pass) {
      console.log('Email secrets not set — skipping email transporter creation');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  } catch (err) {
    console.error('Error getting email transporter:', err);
    return null;
  }
};
```

- [ ] **Step 3: Find and replace all other inline `createTransport({ service: 'gmail' })` calls in `functions/index.js`**

```bash
grep -n "service: 'gmail'" functions/index.js
```

For each match (lines 568 and 792 as of last read), replace with the Umbler pattern:

```js
// Line ~568 — replace:
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: emailUser, pass: emailPass } });

// With:
const transporter = nodemailer.createTransport({
  host: emailHostSecret.value() || 'smtp.umbler.com',
  port: Number(emailPortSecret.value() || 587),
  secure: false,
  auth: { user: emailUser, pass: emailPass },
});
```

Repeat for line ~792.

- [ ] **Step 4: Replace transport in `functions/sendAdminEmail.js`**

Add the two new secrets at the top:

```js
const emailHostSecret = defineSecret('EMAIL_HOST');
const emailPortSecret = defineSecret('EMAIL_PORT');
```

Replace the `createTransport` call (line 61–62):

```js
// Before:
const transporter = nodemailer.createTransport({
  service: 'gmail',
  // ...
});

// After:
const transporter = nodemailer.createTransport({
  host: emailHostSecret.value() || 'smtp.umbler.com',
  port: Number(emailPortSecret.value() || 587),
  secure: false,
  auth: { user: emailUserSecret.value(), pass: emailPasswordSecret.value() },
});
```

- [ ] **Step 5: Update `from:` field fallback in `functions/index.js`**

Find all lines with `functions.config().email?.user || 'contato@...'` fallbacks (lines 74, 278, 816). Update the fallback domain:

```bash
grep -n "contato@\|noreply@" functions/index.js
```

Replace any `@myrealwise.web.app` or `@realwise.web.app` fallback with `@realwise.com.br`:

```js
from: emailUserSecret.value() || 'contato@realwise.com.br',
```

- [ ] **Step 6: Commit**

```bash
git add functions/index.js functions/sendAdminEmail.js
git commit -m "feat: swap Gmail SMTP for Umbler SMTP in email transporter"
```

---

### Task 6: Update email templates domain

**Files:**
- Modify: `functions/emailTemplates.js`

- [ ] **Step 1: Verify renames from Task 4 are correct**

```bash
grep -n "Realwise\|realwise\|moneywise" functions/emailTemplates.js
```

Expected: only "Realwise" and "realwise.com.br" — no remaining "moneywise" or "mymoneywise".

- [ ] **Step 2: Fix any remaining `.web.app` URL in templates**

```bash
grep -n "web\.app\|mymoneywise\|myrealwise" functions/emailTemplates.js
```

For any match, replace with `realwise.com.br`:

- `https://moneywise.web.app` → `https://realwise.com.br`
- `https://mymoneywise.web.app` → `https://realwise.com.br`
- `https://myrealwise.web.app` → `https://realwise.com.br`

The `accessGrantedTemplate` receives a `loginUrl` parameter — update its default:

```js
exports.accessGrantedTemplate = (name, loginUrl = 'https://app.realwise.com.br') => getBaseTemplate({
```

The `acceptMigrationTemplate` similarly:

```js
exports.acceptMigrationTemplate = (name, migrationUrl = 'https://app.realwise.com.br') => getBaseTemplate({
```

- [ ] **Step 3: Commit**

```bash
git add functions/emailTemplates.js
git commit -m "feat: update email templates to Realwise brand and realwise.com.br domain"
```

---

### Task 7: Legacy redirect shim

**Files:**
- Create: `public/redirect/index.html`
- Modify: `firebase.json`

- [ ] **Step 1: Create the redirect page**

Create `public/redirect/index.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redirecting…</title></head>
<body>
<script>
  (function () {
    var m = location.pathname.match(/^\/([^/]+)(\/.*)?$/);
    var tenant = m ? m[1] : 'app';
    var rest = (m && m[2]) ? m[2] : '/';
    location.replace('https://' + tenant + '.realwise.com.br' + rest + location.search + location.hash);
  })();
</script>
<noscript>
  <p>Please enable JavaScript to be redirected, or visit
  <a href="https://realwise.com.br">realwise.com.br</a>.</p>
</noscript>
</body>
</html>
```

- [ ] **Step 2: Add `legacy-redirect` hosting target to `firebase.json`**

Add a second `hosting` entry. The current `firebase.json` has a single hosting object; Firebase supports an array:

```json
{
  "firestore": { "rules": "firestore.rules" },
  "functions": { "source": "functions", "runtime": "nodejs20" },
  "hosting": [
    {
      "site": "mymoneywise",
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        { "source": "**", "destination": "/index.html" },
        { "source": "/", "destination": "/index.html" }
      ],
      "headers": [
        {
          "source": "/clients/**",
          "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
        },
        {
          "source": "**/*.@(js|css)",
          "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
        },
        {
          "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
          "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
        }
      ]
    },
    {
      "site": "realwise-redirect",
      "public": "public/redirect",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ],
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

Note: You'll need to create the `realwise-redirect` hosting site in the Firebase Console (`moneywise-ad9ec`) before deploying. The `mymoneywise` site must have the old domain (the one currently in use) as its custom domain so existing links hit the redirect.

- [ ] **Step 3: Commit**

```bash
git add public/redirect/index.html firebase.json
git commit -m "feat: add legacy redirect shim for moneywise.web.app → realwise.com.br"
```

---

### Task 8: Update CLAUDE.md and README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (if it exists; create a basic one if not)

- [ ] **Step 1: Update CLAUDE.md product name and domain**

In `CLAUDE.md`, update the Project Overview:

```markdown
**Realwise** is a multi-client personal finance SaaS PWA built with React 19, Vite, and Tailwind CSS v4. One codebase and one Firebase Hosting deployment (`realwise.com.br`) serves many clients — each with their own isolated Firebase project (Auth + Firestore) and per-client feature flags.

- URL pattern: `{clientId}.realwise.com.br/dashboard`
- Client config is fetched at runtime from `public/clients/{clientId}.json`
- Firebase is initialized lazily (not at module load time)
```

- [ ] **Step 2: Update CLAUDE.md architecture section**

Update the routing description:

```markdown
- `src/config/clientConfig.js` — `extractClientId(hostname)` reads the first hostname label
```

- [ ] **Step 3: Add local dev note to README (or CLAUDE.md)**

Add under the Commands section:

```markdown
### Local tenant testing

- Default dev client uses Vite env vars (see `.env`)  
- To test a specific tenant subdomain locally, open: `http://{clientId}.localhost:5173/dashboard`  
  (works in Chrome/Firefox/Safari on macOS without `/etc/hosts` changes)  
- Shared login locally: `http://app.localhost:5173/login`
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README for Realwise brand and subdomain routing"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run src/
```

Expected: all tests pass, no "moneywise" left in test descriptions.

- [ ] **Step 2: Grep for any remaining old brand strings in source**

```bash
grep -rn --include="*.js" --include="*.jsx" --include="*.html" --include="*.json" \
  "Moneywise\|MoneyWise\|moneywise\|Limas Finance\|limasfinance\|mymoneywise\|myrealwise\.web\.app" \
  src/ landing_page/ functions/ scripts/ index.html package.json \
  | grep -v node_modules | grep -v ".firebaserc"
```

Expected: zero matches (or only intentional ones like commit messages).

- [ ] **Step 3: Build to verify no build errors**

```bash
npm run build
```

Expected: exits with 0, produces `dist/`.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -u
git commit -m "fix: cleanup remaining brand string stragglers"
```

---

## Manual Steps (done by you, not code)

After the code PR is merged and deployed:

1. **Umbler panel:** Copy SMTP host (confirm `smtp.umbler.com`), copy MX/SPF/DKIM DNS values.
2. **registro.br / Cloudflare DNS:** Add Firebase A records for apex + wildcard, add Umbler MX/SPF/DKIM records.
3. **Firebase Hosting Console** (`moneywise-ad9ec`): Add custom domains `realwise.com.br` and `*.realwise.com.br`; verify ownership via TXT record.
4. **Firebase Secrets:**
   ```bash
   firebase functions:secrets:set EMAIL_USER     # contato@realwise.com.br
   firebase functions:secrets:set EMAIL_PASSWORD  # Umbler mailbox password
   firebase functions:secrets:set EMAIL_HOST      # smtp.umbler.com
   firebase functions:secrets:set EMAIL_PORT      # 587
   firebase deploy --only functions
   ```
5. **Each client Firebase project** (Auth → Settings → Authorized domains): add `realwise.com.br`, `app.realwise.com.br`, `{clientId}.realwise.com.br` for each active tenant.
6. **Firebase Console** — create the `realwise-redirect` hosting site before deploying that target.
7. **Stripe Dashboard:** Update success/cancel URL domain if your webhook endpoint is hosting-bound.
8. **Meta WhatsApp:** Update webhook URL if it pointed at the old hosting URL.
9. **Smoke test:** Login at `https://jonathalimax.realwise.com.br/login`, verify dashboard loads, send a test bill reminder email, confirm it arrives from `contato@realwise.com.br`.
