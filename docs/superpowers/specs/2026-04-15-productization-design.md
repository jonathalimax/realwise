# Productization Design — Limas Finance

**Date:** 2026-04-15  
**Status:** Approved

## Overview

Transform Limas Finance from a personal finance tracker into a sellable product. Each client gets their own isolated Firebase project (Auth + Firestore) while the app is hosted and maintained on a single deployment by the developer. One codebase, one deploy, many clients.

---

## 1. URL & Hosting Structure

Each client gets a subdomain on the developer's custom domain:

```
app.limasfinance.com.br        ← developer's own account / demo
clienta.limasfinance.com.br
clientb.limasfinance.com.br
```

- Register `limasfinance.com.br` on Registro.br (~R$40/year)
- Firebase Hosting serves one site; each subdomain is added as a custom domain pointing to the same hosting project
- Custom domains are free on Firebase Spark plan (up to 36)

**Adding a new client:** Add subdomain in Firebase Hosting console → drop their config JSON → done. No code changes, no redeploy.

---

## 2. Per-Client Config & Feature Flags

On app load, the app:
1. Reads `window.location.hostname` → extracts subdomain (e.g. `clienta`)
2. Fetches `/clients/clienta.json` from the hosting's public folder
3. Initializes Firebase with that client's credentials
4. Reads feature flags from the same config

Client config format (`public/clients/{subdomain}.json`):

```json
{
  "firebase": {
    "apiKey": "...",
    "authDomain": "clienta-finance.firebaseapp.com",
    "projectId": "clienta-finance",
    "storageBucket": "...",
    "messagingSenderId": "...",
    "appId": "..."
  },
  "features": {
    "investments": false,
    "b3Sync": false,
    "whatsapp": false,
    "goals": false,
    "salaryBreakdown": false
  },
  "clientName": "Nome do Cliente"
}
```

A new hook `src/config/useClientConfig.js` loads this config at startup and provides it via a `ClientConfigContext`. All feature flag checks happen through this context.

**Toggling a feature for one client:** Edit their JSON file → next deploy picks it up. No code changes needed.

---

## 3. Firebase Project Setup Per Client

- Developer creates Firebase project on their own Google account
- Developer configures Firestore rules, Auth settings, initial user account
- Client is the owner of their Firebase project (created under their Google account, or transferred)
- Developer is added as **Editor** member for ongoing support and configuration
- Client's Firebase credentials go into their `clients/{subdomain}.json`

Clients are sold on full data ownership — their Firestore and Auth belong entirely to their Firebase project.

---

## 4. Auth

Keep existing Google login + email/password as-is. No changes to auth flow.

---

## 5. Feature Flags Reference

| Flag | Default | Description |
|------|---------|-------------|
| `investments` | `false` | Investments page, Investment Form, Investment Planner |
| `b3Sync` | `false` | B3 stock sync, B3 CSV/XLSX import |
| `whatsapp` | `false` | WhatsApp bill reminder notifications |
| `goals` | `false` | Goals page and progress tracking |
| `salaryBreakdown` | `false` | Gross → net salary deduction fields in Renda tab |

All flags default to `false`. Developer explicitly enables per client.

---

## 6. Project Cleanup

### Remove entirely
- `pages/Home.jsx` — personal landing page
- `pages/Donations.jsx`, `pages/FeatureRequest.jsx`, `pages/Support.jsx` — personal pages
- `pages/Purchase.jsx`, `pages/PurchaseSuccess.jsx`, `pages/PurchaseFailure.jsx` — Mercado Pago purchase flow
- `pages/Admin.jsx` — personal admin panel
- Firebase functions: `createPayment`, `mercadoPagoWebhook` — Mercado Pago integration

### Feature-flagged (hidden unless enabled)
- `pages/Investments.jsx`, `pages/InvestmentForm.jsx` — behind `features.investments`
- B3 sync button in ImportModal — behind `features.b3Sync`
- WhatsApp components — behind `features.whatsapp`
- `pages/Goals.jsx` — behind `features.goals`
- Salary deduction fields in Renda tab — behind `features.salaryBreakdown`

### Stays core (always enabled)
- Dashboard, Transactions, Expenses, Income
- Bills, Cards, Import, Settings
- Planner (Alocação + Renda tabs)
- Wallet

---

## 7. Planner Restructure

The Planner has two tabs, both core and always enabled:

- **Alocação** — existing allocation view, no changes
- **Renda** — replaces the "Sistema" tab entirely

**Renda tab:**
- Input: salário bruto (or líquido if `salaryBreakdown` is off)
- If `features.salaryBreakdown = true`: user adds custom deduction fields (INSS, IR, VT, VR, etc.) with labels and values
- Output: salário líquido, which flows into the Alocação tab as the base value

---

## 8. Onboarding Wizard

Replaces the current `TutorialModal`. Runs on first login. Progress stored in Firestore at `settings.onboardingStep` so the user resumes where they left off if they close midway.

### Step 1 — Contas & Cartões
Add at least one bank account or credit card. Required — cannot skip.

### Step 2 — Renda
Set salary in the Renda tab. If `features.salaryBreakdown` is on, shows deduction fields. Otherwise shows a single "Salário líquido" input.

### Step 3 — Alocação
Brief intro to the Planner. User sets at least one allocation target. Can be completed properly later.

### Step 4 — Primeira Transação
Two options side by side: **Importar CSV** or **Adicionar manualmente**. Either one completes the wizard.

---

## 9. New Files

| File | Purpose |
|------|---------|
| `src/config/useClientConfig.js` | Hook that loads subdomain config on startup |
| `src/contexts/ClientConfigContext.jsx` | Provides Firebase config + feature flags to the app |
| `public/clients/app.json` | Developer's own config (all features enabled) |
| `public/clients/{subdomain}.json` | Per-client config (one file per client) |

---

## 10. Deployment

- **Bug fix / feature update:** push to `main` → deploy once to your Firebase Hosting → all clients get the update instantly
- **New client:** create Firebase project → add as Editor → drop `public/clients/{subdomain}.json` → add subdomain in Firebase Hosting → deploy
- **Toggle feature for client:** edit their JSON → deploy
