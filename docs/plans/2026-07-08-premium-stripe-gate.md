# Premium Stripe Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Alinhar a experiencia de monetizacao do Realwise para um core gratuito com upgrade premium via Stripe e copy em pt-BR.

**Architecture:** A landing passa a empurrar o usuario para o login gratuito, enquanto o app mostra gates premium explicitos nas rotas desligadas por flag. O checkout premium usa uma URL Stripe configurada externamente, com prefill de email, nome e cupom quando houver esses dados no contexto.

**Tech Stack:** React, React Router, Vite, config JSON publica do cliente, Vitest/Jest front-end tests

---

### Task 1: Registrar a URL de checkout Stripe

**Files:**
- Modify: `apps/web/src/config/clientConfig.js`
- Modify: `apps/web/public/clients/app.dev.json`

**Step 1: Adicionar suporte a `stripePaymentLinkUrl` no config do cliente**

**Step 2: Expor um valor de desenvolvimento para testes locais**

**Step 3: Validar que o app continua carregando sem quebrar quando a URL nao estiver configurada**

### Task 2: Centralizar o handoff para Stripe

**Files:**
- Create: `apps/web/src/lib/payments/buildStripeCheckoutUrl.js`
- Test: `apps/web/src/lib/payments/buildStripeCheckoutUrl.test.js`

**Step 1: Escrever testes para montar a URL com email, nome, cupom e locale**

**Step 2: Implementar o helper minimo**

**Step 3: Rodar os testes focados**

### Task 3: Criar gate premium em pt-BR

**Files:**
- Create: `apps/web/src/components/premium/PremiumFeatureGate.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/components/Sidebar.jsx`

**Step 1: Criar a UI do gate com explicacao de 45 dias e CTA para upgrade**

**Step 2: Ligar o gate nas rotas desligadas por flag**

**Step 3: Ajustar a navegacao para a feature continuar visivel e cair no gate**

### Task 4: Atualizar o checkout premium

**Files:**
- Modify: `apps/web/src/pages/CheckoutRedirect.jsx`

**Step 1: Ler parametros de prefill da URL**

**Step 2: Redirecionar para Stripe com locale pt-BR e email preenchido**

**Step 3: Mostrar fallback amigavel quando a URL Stripe nao estiver configurada**

### Task 5: Ajustar a landing para o novo modelo

**Files:**
- Modify: `apps/web/src/components/landing/HeroSection.jsx`
- Modify: `apps/web/src/components/landing/PricingSection.jsx`
- Modify: `apps/web/src/components/landing/FooterSection.jsx`
- Modify: `apps/web/src/components/LanguageToggle.jsx`
- Modify: `apps/web/src/lib/ptTranslations.js`

**Step 1: Trocar CTAs principais para `/login`**

**Step 2: Atualizar a copy para deixar claro o que e gratis e o que e premium**

**Step 3: Manter toda a mensagem principal em pt-BR**

### Task 6: Verificacao

**Files:**
- Test: `apps/web/src/lib/payments/buildStripeCheckoutUrl.test.js`

**Step 1: Rodar os testes focados**

Run: `pnpm test -- --runInBand apps/web/src/lib/payments/buildStripeCheckoutUrl.test.js`

**Step 2: Rodar lint do web**

Run: `pnpm lint`

**Step 3: Rodar build do web**

Run: `pnpm build`
