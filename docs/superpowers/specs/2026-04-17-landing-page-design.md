# Landing Page Design — Moneywise

**Date:** 2026-04-17
**Status:** Approved

## Overview

Build a persuasive, conversion-focused landing page to sell Moneywise to individual Brazilians. The page is in Portuguese only, highlights every enabled feature, and integrates Stripe Checkout for a one-time payment of 12x R$39,99. Key differentiators: no monthly subscription, data owned entirely by the user (their own Google Firebase), lifetime support, and optional paid upgrades.

---

## 1. Strategy

**Approach:** Refactor existing landing page components + add new high-conversion sections.

- Keep the design system (Framer Motion, Tailwind CSS v4, emerald accent colors, dark mode)
- Replace all bilingual copy with persuasive PT-BR
- Remove `BetaSection` and `LanguageProvider` dependency
- Add `PainPointsSection` and `WhyMoneywise` (comparison) sections
- Wire Stripe Checkout into the pricing button via a new Firebase Function

---

## 2. Page Sections (in order)

### 2.1 Header
- Logo "Moneywise"
- Nav links: Funcionalidades · Preço · FAQ
- CTA button: "Comprar agora" (links to pricing section)
- Sticky on scroll, with blur backdrop

### 2.2 Hero
- **Headline:** "Controle financeiro completo. Pague uma vez, use para sempre."
- **Subheadline:** "Sem mensalidade. Seus dados ficam 100% no seu Google. Acesso vitalício, suporte incluído."
- **CTA button:** "Começar agora — 12x de R$39,99"
- **Note:** "Sem assinatura. Sem mensalidade. Acesso vitalício."
- App screenshot carousel (existing screenshots: `/dashboard-overview.png`, `/dashboard-categories.png`)
- Desktop + mobile icons ("Funciona no celular e no computador")

### 2.3 Pain Points — "Você se identifica?"
Four cards, each describing a pain point the app solves:
1. "Não sei pra onde vai meu dinheiro todo mês" → Dashboard + categorias automáticas
2. "Esqueço de pagar contas e pago juros à toa" → Gestão de contas com alertas
3. "Tenho dados espalhados em vários apps e planilhas" → Tudo num só lugar, com importação automática
4. "Pago mensalidade pra app que não uso direito" → Pague uma vez, use para sempre

### 2.4 Features — "Tudo que você precisa"
Grid of features (icon + title + short description):

| Feature | Description |
|---------|-------------|
| Dashboard | Visão geral das suas finanças em tempo real |
| Transações | Registre receitas e despesas com categorias personalizadas |
| Contas a pagar | Nunca mais esqueça uma conta — acompanhe status e vencimentos |
| Cartões de crédito | Controle faturas e datas de pagamento por cartão |
| Importação de extrato | Importe CSV do Nubank, Itaú e Bradesco automaticamente |
| Planejador de renda | Configure seu salário e deduções para saber seu líquido real |
| Alocação de orçamento | Distribua sua renda em categorias com metas percentuais |
| Carteira de investimentos | Acompanhe sua carteira e diversificação por classe de ativo |
| Modo escuro | Interface clara ou escura, como preferir |
| PWA | Instale no celular ou use no navegador — funciona offline |
| Onboarding guiado | Configuração assistida passo a passo ao criar sua conta |

### 2.5 Why Moneywise — "Por que o Moneywise?"
Side-by-side comparison table:

| | Moneywise | Apps de assinatura |
|---|---|---|
| Pagamento | Uma vez (12x R$39,99) | Todo mês para sempre |
| Acesso aos seus dados | Só você — no seu Google | Nos servidores deles |
| Suporte | Vitalício, incluído | Enquanto pagar |
| Correções e segurança | Sempre gratuitas | Incluídas na assinatura |
| Novas funcionalidades | Opcionais — pague só o que quiser | Forçado a pagar tudo |

Supporting copy: "Seus dados ficam armazenados no seu próprio projeto Firebase — vinculado à sua conta Google. Nenhum servidor nosso tem acesso. Você é o dono dos seus dados."

### 2.6 Pricing — "Acesso vitalício"
Single pricing card:
- Badge: "Pagamento único"
- Title: "Acesso completo, para sempre"
- Price: **12x de R$39,99** (total R$479,88)
- Checklist of what's included (all core features + lifetime support + free security updates)
- **CTA button:** "Comprar agora" → triggers Stripe Checkout
- Guarantee note: "Suporte por e-mail incluído para sempre"
- Trust signals: "Pagamento seguro via Stripe · Seus dados só seus"

### 2.7 FAQ
1. O que acontece depois que eu pagar? → Receberá acesso em até 24h com instruções de configuração
2. Meus dados ficam seguros? → Sim, ficam no seu próprio Firebase/Google
3. Funciona no celular? → Sim, PWA instalável no Android e iOS
4. Posso importar meu extrato bancário? → Sim, Nubank, Itaú e Bradesco com detecção automática
5. O que são as novas funcionalidades pagas? → Features extras opcionais lançadas futuramente (ex: sync B3, WhatsApp). Você escolhe se quer e paga separadamente
6. E se eu tiver problemas? → Suporte vitalício por e-mail incluído na compra

### 2.8 Footer
- Logo + tagline: "Controle financeiro do jeito certo."
- Links: Funcionalidades · Preço · FAQ · Contato
- Copyright
- Final mini-CTA: "Pronto para assumir o controle?" + botão "Comprar agora"

---

## 3. Stripe Integration

### Flow
1. User clicks "Comprar agora" on pricing section
2. Frontend calls Firebase Function `createCheckoutSession`
3. Function creates Stripe Checkout Session (one-time payment, `payment_mode`)
4. User is redirected to Stripe-hosted checkout page
5. On success → redirect to `/purchase-success`
6. On cancel → redirect back to landing page
7. Stripe webhook (`checkout.session.completed`) → Firebase Function `stripeWebhook` notifies developer (email) to set up client access

### Firebase Function: `createCheckoutSession`
```
POST /createCheckoutSession
→ Creates Stripe Checkout session
→ Returns { url: "https://checkout.stripe.com/..." }
```

Parameters:
- `price_data.currency`: "brl"
- `price_data.unit_amount`: 47988 (R$479,88 in centavos)
- `payment_method_types`: ["card"]
- `mode`: "payment"
- Installments: enabled via `payment_method_options.card.installments` (allows up to 12x)

### Firebase Function: `stripeWebhook`
- Verifies Stripe signature
- On `checkout.session.completed` → sends email notification to developer with buyer's email

### Config
- `stripe.secret_key` — Firebase Functions config
- `stripe.webhook_secret` — Firebase Functions config
- `stripe.price_id` — optional, or use inline price_data

---

## 4. New Pages

### `/purchase-success`
- Simple confirmation page: "Pagamento confirmado! Em até 24h você receberá as instruções de acesso por e-mail."
- Link back to landing

### `/purchase-failure` (cancel URL)
- Redirects back to landing page with `?cancelled=true` query param
- Landing page shows a dismissible toast: "Pagamento cancelado. Tente novamente quando quiser."

---

## 5. Files Changed / Created

### Modified
- `landing_page/pages/home.jsx` — remove `LanguageProvider`, PT-only
- `landing_page/components/landing/Header.jsx` — PT-only, remove language toggle
- `landing_page/components/landing/HeroSection.jsx` — new copy + updated CTA
- `landing_page/components/landing/FeaturesSection.jsx` — PT-only, full feature grid
- `landing_page/components/landing/PricingSection.jsx` — PT-only, Stripe CTA, updated price
- `landing_page/components/landing/FAQSection.jsx` — PT-only, new questions
- `landing_page/components/landing/FooterSection.jsx` — PT-only, final CTA

### New
- `landing_page/components/landing/PainPointsSection.jsx`
- `landing_page/components/landing/WhyMoneywiseSection.jsx`
- `landing_page/pages/PurchaseSuccess.jsx`
- `functions/createCheckoutSession.js`
- `functions/stripeWebhook.js`

### Removed
- `landing_page/components/landing/BetaSection.jsx` (obsolete)
- `landing_page/components/LanguageToggle.jsx` dependency (landing page only)

---

## 6. Routing

The landing page lives at `/` (root). The app router in `App.jsx` already handles the case where `pathname === '/'` by redirecting to `/{clientId}/`. The landing page must be served at the root before that redirect kicks in.

**Implementation:** In `App.jsx`, when `pathname === '/'` render `<LandingPage />` instead of redirecting to `/{clientId}/`. The landing page does not need Firebase or `ClientConfigProvider`. The `BrowserRouter` is not used for the landing — it renders as a plain React component outside the router.

`/purchase-success` is also handled at the root level in `App.jsx` (same pattern — check `pathname`, render `<PurchaseSuccess />` before routing).

---

## 7. Open Questions (resolved)

- Language: Portuguese only
- Payment: Stripe, one-time, 12x R$39,99
- New features model: optional paid upgrades, security fixes always free
- Target audience: individual Brazilians
