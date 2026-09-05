# Moneywise Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persuasive PT-BR landing page for Moneywise with Stripe Checkout integration (12x R$39,99 one-time payment), replacing the old bilingual landing page.

**Architecture:** Refactor existing components in `landing_page/` to PT-only, add `PainPointsSection`, `WhyMoneywiseSection`, and `CheckoutModal`. A `createCheckoutSession` Firebase Function (Stripe) is called from the modal, stores a lead in Firestore, and returns a Stripe-hosted checkout URL. A `stripeWebhook` function marks the lead paid and emails the developer. Landing page renders at `/` in `App.jsx` before any Firebase initialization; `PurchaseSuccess` renders at `/purchase-success` the same way.

**Tech Stack:** React 19, Framer Motion, Tailwind CSS v4, Lucide React, `@/components/ui/button` (shadcn), Stripe Node SDK, Firebase Functions Gen 1 (Node 18), Firebase Firestore

---

## File Map

### Modified
| File | Change |
|------|--------|
| `src/App.jsx` | Render `<LandingPage>` at `/`, `<PurchaseSuccess>` at `/purchase-success` (lazy, before Firebase) |
| `landing_page/pages/home.jsx` | Relative imports, remove `LanguageProvider`, wire `onBuy` prop + `CheckoutModal` |
| `landing_page/components/landing/Header.jsx` | PT-only, smooth-scroll nav, CTA triggers `onBuy` |
| `landing_page/components/landing/HeroSection.jsx` | New PT copy, CTA triggers `onBuy`, fix browser URL |
| `landing_page/components/landing/FeaturesSection.jsx` | PT-only 12-feature grid, remove `useLanguage` |
| `landing_page/components/landing/PricingSection.jsx` | 12x R$39,99, CTA triggers `onBuy`, remove `useLanguage` |
| `landing_page/components/landing/FAQSection.jsx` | PT-only 6 new questions, remove `useLanguage` |
| `landing_page/components/landing/FooterSection.jsx` | PT-only, remove `createPageUrl`/`Link`/`useLanguage`, final CTA |
| `functions/index.js` | Export `createCheckoutSession` and `stripeWebhook` |
| `functions/package.json` | Add `stripe` dependency |

### Created
| File | Purpose |
|------|---------|
| `landing_page/components/landing/PainPointsSection.jsx` | 4-card "Você se identifica?" pain points |
| `landing_page/components/landing/WhyMoneywiseSection.jsx` | Comparison table vs subscription apps |
| `landing_page/components/landing/CheckoutModal.jsx` | Modal: Nome + E-mail + WhatsApp → `createCheckoutSession` → Stripe redirect |
| `landing_page/pages/PurchaseSuccess.jsx` | Confirmation page at `/purchase-success` |
| `functions/createCheckoutSession.js` | Stripe Checkout Session + Firestore lead upsert |
| `functions/stripeWebhook.js` | Webhook: mark lead paid, email developer |

### Deleted
| File | Reason |
|------|--------|
| `landing_page/components/landing/BetaSection.jsx` | Obsolete |

---

## Task 1: Routing — landing page at `/`, purchase success at `/purchase-success`

**Files:**
- Modify: `src/App.jsx`
- Modify: `landing_page/pages/home.jsx`

- [ ] **Step 1: Rewrite `landing_page/pages/home.jsx`**

`home.jsx` currently has broken import paths (`@/components/landing/...` resolves to `src/components/landing/` which doesn't exist) and wraps everything in `LanguageProvider`. Replace the entire file:

```jsx
import React, { useState } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import WhyMoneywiseSection from '../components/landing/WhyMoneywiseSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FooterSection from '../components/landing/FooterSection';
import CheckoutModal from '../components/landing/CheckoutModal';

export default function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      <Header onBuy={() => setCheckoutOpen(true)} />
      <div className="pt-20">
        <HeroSection onBuy={() => setCheckoutOpen(true)} />
        <PainPointsSection />
        <FeaturesSection />
        <WhyMoneywiseSection />
        <PricingSection onBuy={() => setCheckoutOpen(true)} />
        <FAQSection />
        <FooterSection onBuy={() => setCheckoutOpen(true)} />
      </div>
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/App.jsx` — replace the `/` redirect with landing page render**

Locate this block (around line 183):
```jsx
  if (window.location.pathname === '/') {
    window.location.replace(`/${clientId}/`);
    return null;
  }
```

Replace it with:
```jsx
  if (window.location.pathname === '/') {
    const LandingPage = React.lazy(() => import('../landing_page/pages/home'));
    return (
      <React.Suspense fallback={<PageLoader />}>
        <LandingPage />
      </React.Suspense>
    );
  }

  if (window.location.pathname === '/purchase-success') {
    const PurchaseSuccess = React.lazy(() => import('../landing_page/pages/PurchaseSuccess'));
    return (
      <React.Suspense fallback={<PageLoader />}>
        <PurchaseSuccess />
      </React.Suspense>
    );
  }
```

- [ ] **Step 3: Start dev server and confirm the landing page renders at root**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run dev
```

Open `http://localhost:5173/`. Expected: page renders (even with placeholder/missing components it should not crash the router).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx landing_page/pages/home.jsx
git commit -m "feat: route / to landing page and /purchase-success to confirmation"
```

---

## Task 2: Header — sticky, PT nav, CTA button

**Files:**
- Modify: `landing_page/components/landing/Header.jsx`

- [ ] **Step 1: Replace `Header.jsx`**

```jsx
import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Header({ onBuy }) {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="font-semibold text-lg">Moneywise</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollTo('funcionalidades')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Funcionalidades
          </button>
          <button
            onClick={() => scrollTo('preco')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Preço
          </button>
          <button
            onClick={() => scrollTo('faq')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            FAQ
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            size="sm"
            onClick={onBuy}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
          >
            Comprar agora
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify in browser**

Expected: sticky header with "Moneywise" logo (M), nav links, ThemeToggle, and "Comprar agora" button.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/Header.jsx
git commit -m "feat(landing): PT header with smooth-scroll nav and CTA"
```

---

## Task 3: HeroSection — PT copy, updated CTA, fix browser URL

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`

- [ ] **Step 1: Replace `HeroSection.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Monitor, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const screenshots = [
  { src: '/dashboard-overview.png', alt: 'Dashboard' },
  { src: '/dashboard-categories.png', alt: 'Categorias' },
];

export default function HeroSection({ onBuy }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-200/30 dark:bg-slate-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Sem mensalidade · Pague uma vez, use para sempre
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Controle financeiro completo.
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Pague uma vez.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Sem mensalidade. Seus dados ficam 100% no seu Google. Acesso vitalício, suporte incluído.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              size="lg"
              onClick={onBuy}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Começar agora — 12x de R$39,99
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sem assinatura · Sem mensalidade · Acesso vitalício
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="text-sm">Desktop</span>
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <span className="text-sm">Mobile</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-md mx-auto h-6 rounded-md bg-slate-700 flex items-center px-3">
                    <span className="text-xs text-slate-400">moneywise.web.app</span>
                  </div>
                </div>
              </div>

              <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentIndex}
                    src={screenshots[currentIndex].src}
                    alt={screenshots[currentIndex].alt}
                    className="w-full h-full object-cover object-top"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </AnimatePresence>

                <button
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % screenshots.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors backdrop-blur-sm"
                  aria-label="Próximo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {screenshots.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-2 rounded-full transition-all ${index === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/70'}`}
                      aria-label={`Slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

Expected: Hero with PT headline, "Começar agora — 12x de R$39,99" button, screenshot carousel showing `moneywise.web.app`.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/HeroSection.jsx
git commit -m "feat(landing): PT hero — new copy, CTA prop, moneywise.web.app URL"
```

---

## Task 4: PainPointsSection (new)

**Files:**
- Create: `landing_page/components/landing/PainPointsSection.jsx`

- [ ] **Step 1: Create `PainPointsSection.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, AlertCircle, LayoutGrid, CreditCard } from 'lucide-react';

const pains = [
  {
    icon: HelpCircle,
    pain: 'Não sei pra onde vai meu dinheiro todo mês',
    solution: 'Dashboard com visão clara de receitas, despesas e categorias — tudo em tempo real.',
  },
  {
    icon: AlertCircle,
    pain: 'Esqueço de pagar contas e pago juros à toa',
    solution: 'Gerencie todas as contas a pagar com status e vencimentos visíveis de um só lugar.',
  },
  {
    icon: LayoutGrid,
    pain: 'Tenho dados espalhados em vários apps e planilhas',
    solution: 'Importe seu extrato (Nubank, Itaú, Bradesco) e deixe o algoritmo categorizar automaticamente.',
  },
  {
    icon: CreditCard,
    pain: 'Pago mensalidade pra app que não uso direito',
    solution: 'Pague uma vez. Use para sempre. Seus dados no seu Google. Sem surpresas.',
  },
];

export default function PainPointsSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Você se identifica?
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Esses problemas soam familiares?
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {pains.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">"{item.pain}"</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    → {item.solution}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add landing_page/components/landing/PainPointsSection.jsx
git commit -m "feat(landing): add pain points section"
```

---

## Task 5: FeaturesSection — PT-only 12-feature grid, remove useLanguage

**Files:**
- Modify: `landing_page/components/landing/FeaturesSection.jsx`

- [ ] **Step 1: Replace `FeaturesSection.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  CreditCard,
  Upload,
  PiggyBank,
  PieChart,
  BarChart3,
  Moon,
  Smartphone,
  Sparkles,
  Shield,
} from 'lucide-react';

const features = [
  { icon: LayoutDashboard, title: 'Dashboard', desc: 'Visão geral das suas finanças em tempo real' },
  { icon: ArrowLeftRight, title: 'Transações', desc: 'Registre receitas e despesas com categorias personalizadas' },
  { icon: FileText, title: 'Contas a pagar', desc: 'Nunca esqueça uma conta — acompanhe status e vencimentos' },
  { icon: CreditCard, title: 'Cartões de crédito', desc: 'Controle faturas e datas de pagamento por cartão' },
  { icon: Upload, title: 'Importação de extrato', desc: 'Importe CSV do Nubank, Itaú e Bradesco com categorização inteligente' },
  { icon: PiggyBank, title: 'Planejador de renda', desc: 'Configure seu salário e deduções para saber seu líquido real' },
  { icon: PieChart, title: 'Alocação de orçamento', desc: 'Distribua sua renda em categorias com metas percentuais' },
  { icon: BarChart3, title: 'Carteira de investimentos', desc: 'Acompanhe sua carteira e diversificação por classe de ativo' },
  { icon: Sparkles, title: 'Onboarding guiado', desc: 'Configuração assistida passo a passo ao criar sua conta' },
  { icon: Moon, title: 'Modo escuro', desc: 'Interface clara ou escura, como preferir' },
  { icon: Smartphone, title: 'PWA', desc: 'Instale no celular ou use no navegador — acesse de qualquer dispositivo' },
  { icon: Shield, title: 'Privacidade total', desc: 'Seus dados ficam só no seu Google. Ninguém mais tem acesso.' },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Funcionalidades
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Tudo que você precisa
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Pensado para brasileiros que querem controle real, sem complicação.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <feature.icon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{feature.title}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add landing_page/components/landing/FeaturesSection.jsx
git commit -m "feat(landing): PT features section, 12 features, no useLanguage"
```

---

## Task 6: WhyMoneywiseSection (new) — comparison table

**Files:**
- Create: `landing_page/components/landing/WhyMoneywiseSection.jsx`

- [ ] **Step 1: Create `WhyMoneywiseSection.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const rows = [
  { label: 'Pagamento', moneywise: 'Uma vez (12x R$39,99)', others: 'Todo mês para sempre' },
  { label: 'Acesso aos seus dados', moneywise: 'Só você — no seu Google', others: 'Nos servidores deles' },
  { label: 'Suporte', moneywise: 'Vitalício, incluído', others: 'Enquanto pagar' },
  { label: 'Correções e segurança', moneywise: 'Sempre gratuitas', others: 'Incluídas na assinatura' },
  { label: 'Novas funcionalidades', moneywise: 'Opcionais — pague só o que quiser', others: 'Forçado a pagar tudo' },
];

export default function WhyMoneywiseSection() {
  return (
    <section className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Por que o Moneywise?
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Diferente de tudo que você já usou
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Seus dados ficam no seu próprio Firebase — vinculado ao seu Google. Nenhum servidor nosso tem acesso. Você é o dono.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          {/* Header row */}
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <div className="p-4" />
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Moneywise</span>
              </div>
            </div>
            <div className="p-4 text-center">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Apps de assinatura</span>
            </div>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${index % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}
            >
              <div className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                {row.label}
              </div>
              <div className="p-4 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{row.moneywise}</span>
              </div>
              <div className="p-4 flex items-center justify-center gap-1.5">
                <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400">{row.others}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add landing_page/components/landing/WhyMoneywiseSection.jsx
git commit -m "feat(landing): add WhyMoneywise comparison table"
```

---

## Task 7: CheckoutModal — form + Stripe redirect

**Files:**
- Create: `landing_page/components/landing/CheckoutModal.jsx`

- [ ] **Step 1: Create `CheckoutModal.jsx`**

```jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
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

    setLoading(true);
    setError('');

    try {
      const functionUrl = import.meta.env.VITE_CHECKOUT_URL;
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao iniciar pagamento.');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
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
            onClick={onClose}
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
                  onClick={onClose}
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

- [ ] **Step 2: Add `VITE_CHECKOUT_URL` to `.env`**

Create or open `.env` at the project root and add:

```
VITE_CHECKOUT_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/createCheckoutSession
```

Replace `YOUR_PROJECT_ID` with the Firebase project ID (found in Firebase Console → Project Settings).

- [ ] **Step 3: Test modal in browser**

Click "Comprar agora". Expected: modal slides in with three labelled fields and a "Ir para pagamento" button.

Submit empty form. Expected: "Preencha todos os campos." error message appears below fields.

Submit with `notanemail`. Expected: "E-mail inválido." error.

- [ ] **Step 4: Commit**

```bash
git add landing_page/components/landing/CheckoutModal.jsx
git commit -m "feat(landing): checkout modal with name/email/whatsapp validation"
```

---

## Task 8: PricingSection — 12x R$39,99, modal trigger, remove useLanguage

**Files:**
- Modify: `landing_page/components/landing/PricingSection.jsx`

- [ ] **Step 1: Replace `PricingSection.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Shield, Lock, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const included = [
  'Dashboard e visão geral das finanças',
  'Gestão de transações com categorias personalizadas',
  'Contas a pagar com status e vencimentos',
  'Controle de cartões de crédito',
  'Importação de extrato (Nubank, Itaú, Bradesco)',
  'Planejador de renda e alocação de orçamento',
  'Carteira de investimentos',
  'Onboarding guiado passo a passo',
  'Modo escuro + acesso mobile e desktop',
  'Suporte vitalício por e-mail',
  'Correções e segurança — sempre gratuitas',
];

export default function PricingSection({ onBuy }) {
  return (
    <section id="preco" className="py-32 px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Preço
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Acesso vitalício
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Pague uma vez. Use para sempre. Sem mensalidade, sem surpresas.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <div className="relative rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

            <div className="p-10 sm:p-14">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">
                <div className="space-y-4 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Pagamento único
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold">Acesso completo, para sempre</h3>
                  <ul className="space-y-2.5">
                    {included.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-300 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-center lg:text-right space-y-5 lg:min-w-[220px]">
                  <div>
                    <div className="text-4xl font-bold">12x de R$39,99</div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      ou R$479,88 à vista
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={onBuy}
                    className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Comprar agora
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Suporte vitalício por e-mail incluído
                  </p>
                  <div className="flex items-center justify-center lg:justify-end gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Stripe</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Seus dados só seus</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8 max-w-lg mx-auto"
        >
          Atualizações de segurança e correções sempre gratuitas. Novas funcionalidades são upgrades opcionais — você decide se quer e paga só pelo que usar.
        </motion.p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

Scroll to pricing. Expected: card with 11-item checklist, "12x de R$39,99 / ou R$479,88 à vista", "Comprar agora" button that opens CheckoutModal.

- [ ] **Step 3: Commit**

```bash
git add landing_page/components/landing/PricingSection.jsx
git commit -m "feat(landing): PT pricing section — 12x R\$39,99, modal trigger, trust signals"
```

---

## Task 9: FAQSection — PT-only 6 questions, remove useLanguage

**Files:**
- Modify: `landing_page/components/landing/FAQSection.jsx`

- [ ] **Step 1: Replace `FAQSection.jsx`**

```jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'O que acontece depois que eu pagar?',
    answer: 'Em até 24h você receberá um e-mail com as instruções de acesso e configuração do seu Moneywise. Seu banco de dados Firebase será configurado individualmente — seus dados ficarão no seu próprio projeto Google.',
  },
  {
    question: 'Meus dados ficam seguros?',
    answer: 'Sim. Seus dados ficam armazenados no seu próprio projeto Firebase — vinculado à sua conta Google. Nenhum servidor nosso tem acesso. Você é o único dono dos seus dados.',
  },
  {
    question: 'Funciona no celular?',
    answer: 'Sim. O Moneywise é um PWA (Progressive Web App) — você pode instalar no Android ou iOS direto pelo navegador e acessar de qualquer dispositivo.',
  },
  {
    question: 'Posso importar meu extrato bancário?',
    answer: 'Sim. Você importa manualmente o arquivo CSV do seu banco. Nubank, Itaú e Bradesco são suportados com detecção automática de formato. O algoritmo do app categoriza as transações automaticamente.',
  },
  {
    question: 'O que são as novas funcionalidades pagas?',
    answer: 'São features extras opcionais lançadas futuramente — por exemplo, sincronização com a B3, lembretes via WhatsApp, entre outras. Você decide se quer e paga separadamente, sem mudar de plano.',
  },
  {
    question: 'E se eu tiver problemas?',
    answer: 'Suporte vitalício por e-mail está incluído na compra. Correções de bugs e atualizações de segurança são sempre gratuitas.',
  },
];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-base pr-8 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {faq.question}
        </span>
        <ChevronDown className={cn(
          'w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0',
          isOpen && 'rotate-180'
        )} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Perguntas frequentes
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ficou alguma dúvida?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-8"
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add landing_page/components/landing/FAQSection.jsx
git commit -m "feat(landing): PT FAQ with 6 Moneywise-specific questions"
```

---

## Task 10: FooterSection — PT-only, remove legacy deps, final CTA + delete BetaSection

**Files:**
- Modify: `landing_page/components/landing/FooterSection.jsx`
- Delete: `landing_page/components/landing/BetaSection.jsx`

- [ ] **Step 1: Replace `FooterSection.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FooterSection({ onBuy }) {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="relative overflow-hidden">
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Pronto para assumir o controle
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                das suas finanças?
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto">
              Sem mensalidade. Seus dados só seus. Suporte vitalício incluído.
            </p>
            <Button
              size="lg"
              onClick={onBuy}
              className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Comprar agora — 12x de R$39,99
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="font-semibold">Moneywise</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <button onClick={() => scrollTo('funcionalidades')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Funcionalidades
            </button>
            <button onClick={() => scrollTo('preco')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Preço
            </button>
            <button onClick={() => scrollTo('faq')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
              FAQ
            </button>
            <a href="mailto:jonathalimax@gmail.com" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Contato
            </a>
          </nav>

          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Feito com</span>
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>© 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Delete BetaSection**

```bash
rm /Users/jonathalima/Developer/personal/limas-finance/landing_page/components/landing/BetaSection.jsx
```

- [ ] **Step 3: Commit**

```bash
git add -A landing_page/components/landing/
git commit -m "feat(landing): PT footer with final CTA, remove BetaSection"
```

---

## Task 11: PurchaseSuccess confirmation page

**Files:**
- Create: `landing_page/pages/PurchaseSuccess.jsx`

- [ ] **Step 1: Create `PurchaseSuccess.jsx`**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PurchaseSuccess() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl font-bold mb-4">Pagamento confirmado!</h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
          Obrigado pela compra! Em até <strong>24 horas</strong> você receberá um e-mail com as instruções de acesso e configuração do seu Moneywise.
        </p>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-8">
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Mail className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p>Verifique sua caixa de entrada (e o spam) nas próximas horas.</p>
          </div>
        </div>

        <Button
          onClick={() => { window.location.href = '/'; }}
          variant="outline"
          className="rounded-full border-slate-300 dark:border-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao início
        </Button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Verify at `http://localhost:5173/purchase-success`**

Expected: green checkmark, "Pagamento confirmado!", 24h copy, email reminder, back button.

- [ ] **Step 3: Commit**

```bash
git add landing_page/pages/PurchaseSuccess.jsx
git commit -m "feat(landing): purchase success confirmation page"
```

---

## Task 12: `createCheckoutSession` Firebase Function (Stripe)

**Files:**
- Modify: `functions/package.json`
- Create: `functions/createCheckoutSession.js`
- Modify: `functions/index.js`

- [ ] **Step 1: Install Stripe SDK**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance/functions && npm install stripe
```

Expected: `"stripe": "^X.X.X"` appears in `functions/package.json` dependencies.

- [ ] **Step 2: Create `functions/createCheckoutSession.js`**

```js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Stripe = require('stripe');

const db = admin.firestore();

/**
 * Creates a Stripe Checkout Session and upserts a lead in Firestore.
 *
 * POST body: { name: string, email: string, whatsapp: string }
 * Response:  { url: string }  — Stripe hosted checkout URL
 *
 * Firebase config required:
 *   stripe.secret_key  — Stripe secret key (sk_live_... or sk_test_...)
 */
exports.createCheckoutSession = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { name, email, whatsapp } = req.body;

    if (!name || !email || !whatsapp) {
      res.status(400).json({ error: 'name, email e whatsapp são obrigatórios.' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const secretKey = functions.config().stripe?.secret_key;
    if (!secretKey) {
      console.error('stripe.secret_key not configured');
      res.status(500).json({ error: 'Configuração de pagamento ausente.' });
      return;
    }

    const stripe = Stripe(secretKey);

    try {
      // Upsert lead — creates if not exists, updates if returning visitor
      await db.collection('leads').doc(emailLower).set(
        {
          name: name.trim(),
          email: emailLower,
          whatsapp: whatsapp.trim(),
          paid: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: emailLower,
        line_items: [
          {
            price_data: {
              currency: 'brl',
              unit_amount: 47988, // R$479,88 in centavos
              product_data: {
                name: 'Moneywise — Acesso Vitalício',
                description: 'Acesso completo, suporte vitalício, sem mensalidade.',
              },
            },
            quantity: 1,
          },
        ],
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            installments: { enabled: true },
          },
        },
        metadata: {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          email: emailLower,
        },
        success_url: 'https://moneywise.web.app/purchase-success',
        cancel_url: 'https://moneywise.web.app/',
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Stripe createCheckoutSession error:', err);
      res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
    }
  });
});
```

- [ ] **Step 3: Add exports to `functions/index.js`**

At the bottom of `functions/index.js`, after the existing exports, add:

```js
// ============================================================
// STRIPE PAYMENT FUNCTIONS
// ============================================================

const { createCheckoutSession } = require('./createCheckoutSession');
exports.createCheckoutSession = createCheckoutSession;
```

- [ ] **Step 4: Set Stripe secret key in Firebase config**

```bash
firebase functions:config:set stripe.secret_key="sk_test_YOUR_TEST_KEY"
```

Use `sk_test_...` for testing, `sk_live_...` for production.

- [ ] **Step 5: Deploy the function**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && firebase deploy --only functions:createCheckoutSession
```

Expected output includes the function URL:
```
Function URL (createCheckoutSession): https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/createCheckoutSession
```

- [ ] **Step 6: Update `.env` with the real function URL**

```
VITE_CHECKOUT_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/createCheckoutSession
```

- [ ] **Step 7: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance
git add functions/createCheckoutSession.js functions/index.js functions/package.json functions/package-lock.json
git commit -m "feat(functions): createCheckoutSession — Stripe checkout + Firestore lead upsert"
```

---

## Task 13: `stripeWebhook` Firebase Function

**Files:**
- Create: `functions/stripeWebhook.js`
- Modify: `functions/index.js`

- [ ] **Step 1: Create `functions/stripeWebhook.js`**

```js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

const db = admin.firestore();

/**
 * Stripe webhook — handles checkout.session.completed:
 *   1. Marks lead as paid in Firestore
 *   2. Records purchase in `purchases` collection
 *   3. Emails developer with buyer name, email, WhatsApp
 *
 * Firebase config required:
 *   stripe.secret_key      — Stripe secret key
 *   stripe.webhook_secret  — Signing secret from Stripe Dashboard > Webhooks
 *   email.user             — Gmail address for sending notifications
 *   email.password         — Gmail App Password
 *
 * NOTE: This function requires req.rawBody. Firebase Functions Gen 1 provides
 * this automatically for HTTP functions.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secretKey = functions.config().stripe?.secret_key;
  const webhookSecret = functions.config().stripe?.webhook_secret;

  if (!secretKey || !webhookSecret) {
    console.error('Stripe keys not configured');
    res.status(500).send('Configuration error');
    return;
  }

  const stripe = Stripe(secretKey);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).send('OK');
    return;
  }

  const session = event.data.object;
  const email = session.customer_email?.toLowerCase();
  const name = session.metadata?.name || '';
  const whatsapp = session.metadata?.whatsapp || '';
  const amountTotal = session.amount_total; // centavos

  if (!email) {
    console.error('No customer_email in session');
    res.status(200).send('OK');
    return;
  }

  try {
    // Mark lead as paid
    await db.collection('leads').doc(email).set(
      {
        paid: true,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeSessionId: session.id,
        amountTotal,
      },
      { merge: true }
    );

    // Record in purchases collection
    await db.collection('purchases').add({
      email,
      name,
      whatsapp,
      amountTotal,
      stripeSessionId: session.id,
      purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify developer by email
    await sendPurchaseEmail({ name, email, whatsapp, amountTotal });

    console.log('=== NOVA COMPRA (Stripe) ===');
    console.log('Nome:', name);
    console.log('Email:', email);
    console.log('WhatsApp:', whatsapp);
    console.log('Valor: R$', (amountTotal / 100).toFixed(2));
    console.log('Session:', session.id);
    console.log('===========================');

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling checkout.session.completed:', err);
    res.status(500).send('Internal error');
  }
});

async function sendPurchaseEmail({ name, email, whatsapp, amountTotal }) {
  const emailUser = functions.config().email?.user;
  const emailPass = functions.config().email?.password;

  if (!emailUser || !emailPass) {
    console.log('Email not configured — purchase only logged to Firestore');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });

  const amountStr = `R$ ${(amountTotal / 100).toFixed(2)}`;
  const adminEmail = 'jonathalimax@gmail.com';

  await transporter.sendMail({
    from: emailUser,
    to: adminEmail,
    subject: `💰 Nova Compra Moneywise — ${amountStr}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:24px">💰 Nova Compra Realizada!</h1>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none">
          <h2 style="color:#374151;margin-top:0">Dados do Cliente</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Nome:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${name || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">E-mail:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">WhatsApp:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${whatsapp || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280">Valor:</td>
              <td style="padding:10px 0;font-weight:bold;color:#10b981;font-size:18px">${amountStr}</td>
            </tr>
          </table>
        </div>
        <div style="background:#fef3c7;padding:15px;border:1px solid #fcd34d;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0;color:#92400e;font-size:14px">
            <strong>⚡ Ação necessária:</strong> Configure o acesso para <strong>${email}</strong>.
            WhatsApp do cliente: <strong>${whatsapp}</strong>
          </p>
        </div>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Add export to `functions/index.js`**

Add below the `createCheckoutSession` export (inside the STRIPE section):

```js
const { stripeWebhook } = require('./stripeWebhook');
exports.stripeWebhook = stripeWebhook;
```

- [ ] **Step 3: Deploy**

```bash
firebase deploy --only functions:stripeWebhook
```

Expected: function URL logged:
```
Function URL (stripeWebhook): https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook
```

- [ ] **Step 4: Configure webhook in Stripe Dashboard**

1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook`
3. Events to send: `checkout.session.completed`
4. Copy the signing secret shown, then run:

```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SIGNING_SECRET"
firebase deploy --only functions:stripeWebhook
```

(Re-deploy is needed to pick up the new config value.)

- [ ] **Step 5: Commit**

```bash
git add functions/stripeWebhook.js functions/index.js
git commit -m "feat(functions): stripeWebhook — mark lead paid, email developer on purchase"
```

---

## Task 14: End-to-end smoke test

- [ ] **Step 1: Rebuild and run dev server**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run dev
```

- [ ] **Step 2: Scroll through full landing page at `http://localhost:5173/`**

Verify each section appears in order:
- ✅ Header: "Moneywise" (M logo), nav links, ThemeToggle, "Comprar agora"
- ✅ Hero: PT headline "Controle financeiro completo. Pague uma vez.", CTA "Começar agora — 12x de R$39,99", screenshot carousel showing `moneywise.web.app`
- ✅ Pain Points: 4 cards with rose icons and green solution text
- ✅ Features: 12-feature grid (id="funcionalidades")
- ✅ Why Moneywise: comparison table, 5 rows
- ✅ Pricing: checklist card, "12x de R$39,99", "Comprar agora" (id="preco")
- ✅ FAQ: 6 collapsible questions (id="faq")
- ✅ Footer: final CTA, nav links, © 2026

- [ ] **Step 3: Test smooth scroll nav**

Click "Funcionalidades", "Preço", "FAQ" in the header. Each should smoothly scroll to the matching `id`.

- [ ] **Step 4: Test modal**

Click "Comprar agora" in Hero. Modal opens. Fill all three fields with valid data. Click "Ir para pagamento" — should show spinner, then redirect (or error if function URL not configured).

Submit with blank fields. Expected: "Preencha todos os campos."
Submit with bad email. Expected: "E-mail inválido."

- [ ] **Step 5: Test dark mode toggle**

Click ThemeToggle. Full page switches to dark. Click again — back to light.

- [ ] **Step 6: Test purchase success page**

Navigate to `http://localhost:5173/purchase-success`. Expected: confirmation page with checkmark.

- [ ] **Step 7: Run linter**

```bash
npm run lint
```

Expected: no errors introduced by new files. Fix any reported issues before the final commit.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: Moneywise landing page with Stripe checkout — complete"
```
