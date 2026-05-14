# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the landing page with ownership-first positioning, anti-finance-subscription narrative, and scannable premium copy.

**Architecture:** Rewrite existing 7 components + create 3 new section components + update home.jsx section order. All changes are self-contained JSX components — no backend, no Firebase, no routing changes.

**Tech Stack:** React 19, Framer Motion, Lucide React, Tailwind CSS v4, `@/components/ui/button`, `cn` from `@/lib/utils`

**Constraints:**
- Work directly on `main` — no commits, no discarding unstaged changes
- No AI auto-categorization claims anywhere
- Anti-subscription argument is finance-app-specific (not all subscriptions)
- All copy in PT-BR
- Preserve existing color tokens: `emerald`, `teal`, `slate` with dark mode variants

---

## File Map

| Action | File |
|---|---|
| Modify | `landing_page/pages/home.jsx` |
| Modify | `landing_page/components/landing/HeroSection.jsx` |
| Modify | `landing_page/components/landing/PainPointsSection.jsx` |
| **Create** | `landing_page/components/landing/SubscriptionTrapSection.jsx` |
| Modify | `landing_page/components/landing/FeaturesSection.jsx` |
| **Create** | `landing_page/components/landing/DataOwnershipSection.jsx` |
| **Create** | `landing_page/components/landing/ProductShowcaseSection.jsx` |
| Modify | `landing_page/components/landing/WhyRealwiseSection.jsx` |
| Modify | `landing_page/components/landing/PricingSection.jsx` |
| Modify | `landing_page/components/landing/FAQSection.jsx` |
| **Create** | `landing_page/components/landing/FinalCTASection.jsx` |
| Modify | `landing_page/components/landing/FooterSection.jsx` |

---

## Task 1: Update page assembly and section order

**Files:**
- Modify: `landing_page/pages/home.jsx`

- [ ] **Replace `home.jsx` with new section order and imports**

```jsx
import React, { useState } from 'react';
import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import PainPointsSection from '../components/landing/PainPointsSection';
import SubscriptionTrapSection from '../components/landing/SubscriptionTrapSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import DataOwnershipSection from '../components/landing/DataOwnershipSection';
import ProductShowcaseSection from '../components/landing/ProductShowcaseSection';
import WhyRealwiseSection from '../components/landing/WhyRealwiseSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import FinalCTASection from '../components/landing/FinalCTASection';
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
        <SubscriptionTrapSection />
        <FeaturesSection />
        <DataOwnershipSection />
        <ProductShowcaseSection />
        <WhyRealwiseSection />
        <PricingSection onBuy={() => setCheckoutOpen(true)} />
        <FAQSection />
        <FinalCTASection onBuy={() => setCheckoutOpen(true)} />
        <FooterSection onBuy={() => setCheckoutOpen(true)} />
      </div>
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}
```

- [ ] **Verify dev server starts without import errors**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:5173`. The 3 new components don't exist yet — the page will crash. That's expected. Proceed to create them in the next tasks.

---

## Task 2: Rewrite HeroSection

**Files:**
- Modify: `landing_page/components/landing/HeroSection.jsx`

- [ ] **Replace full file content**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HeroSection({ onBuy }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-200/20 dark:bg-teal-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Pagamento único · Acesso vitalício
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Seu app de finanças não devia ser
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              mais uma mensalidade.
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-4 leading-relaxed font-light">
            Realwise é o seu sistema financeiro.
          </p>
          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed font-light">
            Compre uma vez. Use para sempre. Seus dados ficam com você.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
            <Button
              size="lg"
              onClick={onBuy}
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Assumir o controle
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 dark:text-slate-500 mb-16">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Pagamento único
            </span>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </span>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 relative"
        >
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-md mx-auto h-6 rounded-md bg-slate-700 flex items-center px-3">
                    <span className="text-xs text-slate-400">realwise.com.br</span>
                  </div>
                </div>
              </div>
              <div className="aspect-[16/9] bg-slate-900 overflow-hidden">
                <img
                  src="/dashboard-overview.png"
                  alt="Dashboard Realwise"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## Task 3: Rewrite PainPointsSection

**Files:**
- Modify: `landing_page/components/landing/PainPointsSection.jsx`

- [ ] **Replace full file content**

```jsx
import React from 'react';
import { motion } from 'framer-motion';

const pains = [
  '"Pago mensalidade num app de finanças que mal abro."',
  '"Tenho 3 planilhas, 2 apps e ainda não sei pra onde vai meu dinheiro."',
  '"Meus dados estão em servidores de empresas que mudam os termos todo ano."',
  '"Já abandonei vários apps. Ainda pago alguns \'só por garantia\'."',
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
          <h2 className="text-3xl sm:text-4xl font-bold">
            Soa familiar?
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {pains.map((pain, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                {pain}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Task 4: Create SubscriptionTrapSection (NEW)

**Files:**
- Create: `landing_page/components/landing/SubscriptionTrapSection.jsx`

- [ ] **Create the file**

```jsx
import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  {
    value: 'R$ 1.200–4.800',
    label: 'Custo de um app de assinatura em 10 anos',
    accent: false,
  },
  {
    value: 'R$ 479,88',
    label: 'Custo do Realwise. Para sempre.',
    accent: true,
  },
  {
    value: 'R$ 720–4.320+',
    label: 'O que sobra no seu bolso',
    accent: false,
  },
];

export default function SubscriptionTrapSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Por que finanças não combinam com assinatura.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Netflix faz sentido pagar todo mês — sempre tem conteúdo novo. Mas o dashboard
            de finanças que você usa hoje é o mesmo que você vai usar daqui a 5 anos.
            Pagar para sempre por algo que não muda toda semana é a definição de armadilha.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`p-8 rounded-2xl text-center border ${
                stat.accent
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div
                className={`text-2xl sm:text-3xl font-bold mb-2 ${
                  stat.accent
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {stat.value}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Task 5: Rewrite FeaturesSection

**Files:**
- Modify: `landing_page/components/landing/FeaturesSection.jsx`

- [ ] **Replace full file content**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  FileText,
  CreditCard,
  PiggyBank,
  PieChart,
  Shield,
  Smartphone,
} from 'lucide-react';

const clusters = [
  {
    title: 'Clareza',
    features: [
      { icon: LayoutDashboard, title: 'Dashboard em tempo real', desc: 'Veja onde seu dinheiro está, agora.' },
      { icon: Upload, title: 'Importação de extrato', desc: 'Nubank, Itaú, Bradesco. Suba o CSV, organize em minutos.' },
      { icon: BarChart3, title: 'Análise de gastos', desc: 'Padrões, categorias, comparações por mês.' },
    ],
  },
  {
    title: 'Controle',
    features: [
      { icon: FileText, title: 'Contas e alertas', desc: 'Vencimentos, faturas, status. Sem juros por esquecimento.' },
      { icon: CreditCard, title: 'Cartões de crédito', desc: 'Organize por cartão. Saiba quando cada fatura vence.' },
      { icon: PiggyBank, title: 'Planejador de renda', desc: 'Bruto, deduções, líquido real.' },
      { icon: PieChart, title: 'Orçamento e alocação', desc: 'Distribua a renda por categoria com metas.' },
    ],
  },
  {
    title: 'Propriedade',
    features: [
      { icon: Shield, title: 'Seus dados, seu Firebase', desc: 'Sua conta Google, não nossos servidores.' },
      { icon: Smartphone, title: 'PWA', desc: 'Instale no celular, use offline.' },
    ],
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">
            O que você ganha.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-8">
          {clusters.map((cluster, ci) => (
            <motion.div
              key={cluster.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: ci * 0.1 }}
            >
              <div className="mb-4">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase">
                  {cluster.title}
                </span>
              </div>
              <div className="space-y-3">
                {cluster.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <feature.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {feature.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-6.5">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Task 6: Create DataOwnershipSection (NEW)

**Files:**
- Create: `landing_page/components/landing/DataOwnershipSection.jsx`

- [ ] **Create the file**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Cloud, Zap, Download, Lock, ShieldCheck } from 'lucide-react';

const steps = [
  { icon: KeyRound, label: 'Você conecta o Google' },
  { icon: Cloud, label: 'Firebase na sua conta' },
  { icon: Zap, label: 'Realwise lê só quando você usa' },
];

const benefits = [
  { icon: Lock, text: 'Você controla o acesso' },
  { icon: Download, text: 'Pode exportar a qualquer momento' },
  { icon: ShieldCheck, text: 'Se Realwise fechar, seus dados continuam seus' },
];

export default function DataOwnershipSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Seus dados não passam por nós.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A maioria dos apps guarda seus dados nos servidores deles. Realwise não.
            Seus dados vivem na sua própria conta Google Firebase — você é o dono,
            nós somos só a ferramenta.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          {steps.map((step, index) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] leading-tight">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden sm:block text-slate-300 dark:text-slate-600 text-2xl font-light">
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {benefits.map((benefit) => (
            <div
              key={benefit.text}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
            >
              <benefit.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {benefit.text}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

---

## Task 7: Create ProductShowcaseSection (NEW)

**Files:**
- Create: `landing_page/components/landing/ProductShowcaseSection.jsx`

- [ ] **Create the file**

```jsx
import React from 'react';
import { motion } from 'framer-motion';

const scenes = [
  {
    title: 'Do caos à clareza',
    caption: 'Importe o extrato. Organize em minutos.',
    src: '/dashboard-overview.png',
    alt: 'Dashboard com transações organizadas',
  },
  {
    title: 'Padrões que você não via',
    caption: 'Entenda pra onde vai seu dinheiro.',
    src: '/dashboard-categories.png',
    alt: 'Gráficos e categorias de gastos',
  },
];

export default function ProductShowcaseSection() {
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
          <h2 className="text-3xl sm:text-4xl font-bold">
            Veja na prática.
          </h2>
        </motion.div>

        <div className="space-y-16">
          {scenes.map((scene, index) => (
            <motion.div
              key={scene.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="relative mx-auto max-w-4xl">
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-xl" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/15 dark:shadow-black/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                  <img
                    src={scene.src}
                    alt={scene.alt}
                    className="w-full object-cover object-top"
                  />
                </div>
              </div>
              <p className="mt-6 text-base text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{scene.title}</span>
                {' '}— {scene.caption}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Task 8: Rewrite WhyRealwiseSection (expanded comparison)

**Files:**
- Modify: `landing_page/components/landing/WhyRealwiseSection.jsx`

- [ ] **Replace full file content**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const rows = [
  { label: 'Pagamento', realwise: 'Uma vez (R$ 479,88)', others: 'Todo mês, para sempre' },
  { label: 'Custo em 10 anos', realwise: 'R$ 479,88', others: 'R$ 1.200 – 4.800' },
  { label: 'Renovação automática', realwise: 'Nunca', others: 'Todo mês' },
  { label: 'Seus dados ficam', realwise: 'No seu Google Firebase', others: 'Nos servidores deles' },
  { label: 'Se o preço subir', realwise: 'Não te afeta', others: 'Você paga mais ou sai' },
  { label: 'Se a empresa fechar', realwise: 'Seus dados continuam seus', others: 'Você perde tudo' },
  { label: 'Suporte', realwise: 'Vitalício, incluído', others: 'Enquanto pagar' },
  { label: 'Liberdade para sair', realwise: 'Total', others: 'Você perde acesso' },
];

export default function WhyRealwiseSection() {
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
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Realwise vs. apps de assinatura.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <div className="p-4" />
            <div className="p-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Realwise</span>
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
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{row.realwise}</span>
              </div>
              <div className="p-4 flex items-center justify-center gap-1.5">
                <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-500 dark:text-slate-400">{row.others}</span>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center text-slate-500 dark:text-slate-400 mt-8 font-medium"
        >
          Não é só mais barato. É um modelo diferente.
        </motion.p>
      </div>
    </section>
  );
}
```

---

## Task 9: Rewrite PricingSection

**Files:**
- Modify: `landing_page/components/landing/PricingSection.jsx`

- [ ] **Replace full file content**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Lock, Shield, Smartphone, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const included = [
  'Dashboard, transações, contas, cartões',
  'Importação de extrato (Nubank, Itaú, Bradesco)',
  'Planejador, orçamento e alocação',
  'Carteira de investimentos',
  'Seus dados no seu Google Firebase',
  'Suporte por e-mail, vitalício',
  'Atualizações de segurança, sempre grátis',
];

const trust = [
  { icon: Lock, text: '100% seguro (Stripe)' },
  { icon: Shield, text: 'Dados 100% seus' },
  { icon: Smartphone, text: 'Desktop + Mobile' },
  { icon: Database, text: 'Seu Firebase' },
];

export default function PricingSection({ onBuy }) {
  return (
    <section id="preco" className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Uma decisão. Para sempre.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Compre uma vez. Use para sempre. Nunca pague novamente.
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
                <div className="space-y-5 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Pagamento único
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold">Acesso vitalício</h3>
                  <ul className="space-y-2.5">
                    {included.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-300 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6 lg:min-w-[220px]">
                  <div className="text-center lg:text-right">
                    <div className="text-4xl font-bold">12x de R$39,99</div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                      ou R$479,88 à vista
                    </div>
                  </div>

                  <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Assinatura em 10 anos</span>
                      <span className="line-through">R$ 1.200–4.800</span>
                    </div>
                    <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                      <span>Realwise (sempre)</span>
                      <span>R$ 479,88</span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    onClick={onBuy}
                    className="w-full h-14 px-8 text-base bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Assumir o controle
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <div className="flex flex-wrap gap-3 justify-center lg:justify-end">
                    {trust.map((item) => (
                      <span
                        key={item.text}
                        className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500"
                      >
                        <item.icon className="w-3 h-3" />
                        {item.text}
                      </span>
                    ))}
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
          className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8"
        >
          Novas funcionalidades são upgrades opcionais — você decide se quer e paga só pelo que usar.
        </motion.p>
      </div>
    </section>
  );
}
```

---

## Task 10: Rewrite FAQSection

**Files:**
- Modify: `landing_page/components/landing/FAQSection.jsx`

- [ ] **Replace full file content**

```jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'Por que não é uma assinatura?',
    answer: 'Apps de finanças não mudam toda semana — não faz sentido cobrar todo mês. Você compra uma vez, usa para sempre. Sem renovação, sem aumento de preço, sem dependência.',
  },
  {
    question: 'Vou realmente usar? Já abandonei outros apps.',
    answer: 'Setup em 5 minutos. O dashboard mostra valor imediato — você vê seus padrões de gasto desde o primeiro dia. E sem mensalidade, você não tem culpa de "não usar o suficiente".',
  },
  {
    question: 'Como meus dados ficam seguros?',
    answer: 'Seus dados vivem no seu próprio projeto Firebase (infraestrutura do Google). Realwise não tem servidor central com seus dados. Você controla as permissões e pode exportar quando quiser.',
  },
  {
    question: 'E se Realwise fechar?',
    answer: 'Seus dados continuam no seu Firebase — você é o dono. Pode acessá-los pela API do Google, migrar para outro app, ou usar como quiser. Você nunca dependeu de nós.',
  },
  {
    question: 'Funciona no celular?',
    answer: 'Sim. É um PWA — você instala como um app normal no Android ou iPhone. Funciona offline e sincroniza quando conecta.',
  },
  {
    question: 'Diferença para Mobills, YNAB, Organizze?',
    answer: 'Eles são assinatura — você paga enquanto usa. Realwise é compra única — você é dono. Seus dados ficam com você, não com eles. Em 5 anos, você gastou R$600–2.400 com eles e R$479,88 conosco. Uma vez.',
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
    <section id="faq" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">
            Perguntas frequentes.
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

---

## Task 11: Create FinalCTASection (NEW)

**Files:**
- Create: `landing_page/components/landing/FinalCTASection.jsx`

- [ ] **Create the file**

```jsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FinalCTASection({ onBuy }) {
  return (
    <section className="py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Pare de alugar.
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Comece a possuir.
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto">
            Compre uma vez. Use para sempre. Seus dados, seu controle.
          </p>
          <Button
            size="lg"
            onClick={onBuy}
            className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
          >
            Assumir o controle
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
            R$ 479,88 · Pagamento único · Acesso vitalício
          </p>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
            Dúvidas?{' '}
            <a
              href="mailto:jonathalimax@gmail.com"
              className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Envie um e-mail
            </a>
            . Resposta em 24h.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
```

---

## Task 12: Update FooterSection

**Files:**
- Modify: `landing_page/components/landing/FooterSection.jsx`

- [ ] **Remove the top CTA section (it's now handled by FinalCTASection) and update tagline**

Replace full file content:

```jsx
import React from 'react';
import { Heart } from 'lucide-react';

export default function FooterSection() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-10 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold">Realwise</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 pl-12">
            Seu sistema financeiro. Seus dados. Para sempre.
          </p>
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

        <div className="flex flex-col items-end gap-1 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>Feito com</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </div>
          <span>© 2026 Realwise. Seus dados são 100% seus.</span>
        </div>
      </div>
    </footer>
  );
}
```

---

## Task 13: Visual QA

- [ ] **Start dev server and verify the full page**

```bash
npm run dev
```

Open `http://localhost:5173` and check:

1. **Hero** — New headline displays, single dashboard screenshot with glow, trust strip below CTA
2. **Pain Points** — 4 quote-style cards, no solution copy inline
3. **Subscription Trap** — 3 stat cards, finance-specific copy (Netflix analogy present)
4. **Features** — 3 columns (Clareza / Controle / Propriedade), one-line descriptions, no AI categorization mentions
5. **Data Ownership** — 3-step diagram + 3 benefit pills
6. **Product Showcase** — 2 cinematic scenes with browser chrome frames + captions
7. **Comparison** — 8-row table, Realwise column in emerald, closing line present
8. **Pricing** — Value stacking card with comparison block (subscription strikethrough), trust icons
9. **FAQ** — 6 questions, accordion works, shorter answers
10. **Final CTA** — "Pare de alugar" headline, single button, email link below
11. **Footer** — No duplicate CTA, updated tagline, trust statement in copyright

- [ ] **Check mobile layout** at 375px width (Chrome DevTools)

Verify all sections stack cleanly: 3-column grids collapse to 1-column, stat band stacks, comparison table scrolls horizontally or stacks.

- [ ] **Check dark mode** by toggling the theme

All sections should maintain contrast and emerald accents in dark mode.
