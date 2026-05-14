# Landing Page Redesign — Realwise: Ownership-First Positioning

**Date:** 2026-05-12
**Status:** Design Approved (Ready for Implementation Plan)
**Approach:** Complete emotional reframe + structural refresh
**Primary Goal:** Direct checkout completion
**Main Barriers:** Perceived value, uncertainty of need
**Design Principles:** Scannable, punchy, premium. Words earn their place.

---

## 1. POSITIONING

**Core message:**
Your finance app shouldn't be a monthly bill.

**The narrow argument (important):**
We are NOT anti-subscription in general. Netflix, Spotify — those make sense (new content every month).

**Finance apps are different.** The dashboard you use today is the same dashboard you'll use in 5 years. Paying R$15/month forever for something that doesn't change every month is irrational. That's the trap we're calling out — specifically the **finance app subscription model**, not subscriptions in general.

**Key differentiators (priority order):**
1. **One-time purchase** — for finance, ownership beats rental
2. **Your data, your Firebase** — Google account, not our servers
3. **Permanence** — no renewals, no price hikes, no lock-in

**Audience:** Tech-aware adults who want to organize and analyze their finances.

---

## 2. PAGE STRUCTURE

1. **Header** — Sticky, branding, CTA
2. **Hero** — Hook + tension
3. **Pain Points** — Recognition
4. **The Finance Subscription Trap** *(NEW)* — Narrow argument
5. **Features** — Outcome-focused clusters
6. **Your Data, Your Firebase** *(NEW)* — Trust narrative
7. **Product in Action** — 3 transformation scenes
8. **Comparison** — Realwise vs. finance subscription apps
9. **Pricing** — Value framing
10. **FAQ** — Objection handling
11. **Final CTA** — Empowerment
12. **Footer** — Trust signals

**Tone everywhere:** Calm, confident, premium. Short sentences. No marketing hype.

---

## 3. SECTION DETAILS

### 3.1 HEADER
No changes. Keep current implementation.

---

### 3.2 HERO

**Headline:**
"Seu app de finanças não devia ser mais uma mensalidade."

*(Your finance app shouldn't be another monthly bill.)*

**Subheadline (one sentence):**
"Realwise é o seu sistema financeiro. Compre uma vez. Use para sempre. Seus dados ficam com você."

*(Realwise is your financial system. Buy once. Use forever. Your data stays with you.)*

**CTA Button:**
"Assumir o controle"
*(Subtext: "Pagamento único · Acesso vitalício")*

**Visual:**
- Existing dark fintech aesthetic (neon green/cyan)
- Hero image: cleaner dashboard screenshot with elegant device framing + subtle glow
- Remove dual screenshots/carousel — pick **one** strong dashboard image
- Add small trust strip below CTA: "Sem assinatura · Seus dados, seu Firebase · Suporte vitalício"

**What we removed:** Long subheadlines, marketing fluff, multiple CTAs.

---

### 3.3 PAIN POINTS

**Section headline:**
"Soa familiar?"
*(Sound familiar?)*

**4 pain points — short, punchy, no solutions inline:**

1. **"Pago mensalidade num app de finanças que mal abro."**
   *(I pay monthly for a finance app I barely open.)*

2. **"Tenho 3 planilhas, 2 apps e ainda não sei pra onde vai meu dinheiro."**
   *(I have 3 spreadsheets, 2 apps, and still don't know where my money goes.)*

3. **"Meus dados estão espalhados em servidores de empresas que mudam de termos a cada ano."**
   *(My data is spread across servers of companies that change terms every year.)*

4. **"Já abandonei vários apps. Continuo pagando alguns 'só por garantia'."**
   *(I've abandoned several apps. Still paying a few 'just in case'.)*

**Visual:**
- Quote-style cards, minimal text
- Each card: just the pain in big type — no resolution copy
- Resolution comes implicitly in next sections (don't repeat ourselves)

**What we removed:** Solution copy under each pain (redundant — the rest of the page is the solution).

---

### 3.4 THE FINANCE SUBSCRIPTION TRAP *(NEW SECTION)*

**Headline:**
"Por que finanças não combinam com assinatura."
*(Why finance doesn't fit the subscription model.)*

**Single explanatory paragraph (2-3 sentences max):**
"Faz sentido pagar Netflix todo mês — sempre tem conteúdo novo. Mas o dashboard de finanças que você usa hoje é o mesmo que você vai usar daqui a 5 anos. Pagar pra sempre por algo que não muda toda semana é a definição de armadilha."

*(Netflix makes sense to pay monthly — new content every month. But the finance dashboard you use today is the same one you'll use 5 years from now. Paying forever for something that doesn't change every week is the definition of a trap.)*

**3 short stat callouts (no walls of text):**

| | |
|---|---|
| **R$ 1.200–4.800** | Custo de um app de assinatura em 10 anos |
| **R$ 479,88** | Custo de Realwise. Para sempre. |
| **R$ 720–4.320+** | O que sobra no seu bolso |

**Visual:**
- Single horizontal stat band with large neon green numbers
- Minimal supporting copy
- Premium typography spacing

**What we removed:** 3 long cards with bullet lists, repetitive copy.

---

### 3.5 FEATURES

**Headline:**
"O que você ganha."
*(What you get.)*

**3 clusters — each cluster has 2-3 features, one short line each:**

#### **Clareza** *(Clarity)*
- **Dashboard em tempo real** — Veja onde seu dinheiro está, agora.
- **Importação de extrato** — Nubank, Itaú, Bradesco. Suba o CSV, organize em minutos.
- **Análise de gastos** — Padrões, categorias, comparações por mês.

#### **Controle** *(Control)*
- **Contas e cartões** — Vencimentos, faturas, alertas. Sem juros por esquecimento.
- **Planejador de renda** — Bruto, deduções, líquido real.
- **Orçamento e alocação** — Distribua a renda por categoria com metas.

#### **Propriedade** *(Ownership)*
- **Seus dados, seu Firebase** — Sua conta Google, não nossos servidores.
- **PWA** — Instale no celular, use offline.
- **Acesso vitalício** — Pague uma vez. Use para sempre.

**Visual:**
- 3 columns side-by-side (stacks on mobile)
- One icon + bold title + one line per feature
- No paragraphs, no marketing copy

**What we removed:**
- "Categorização automática com IA" → swapped for "Importação de extrato" (manual + format detection only)
- Long benefit-focused sentences → cut to one line
- 11 individual features → 9 grouped features

---

### 3.6 YOUR DATA, YOUR FIREBASE *(NEW SECTION)*

**Headline:**
"Seus dados não passam por nós."
*(Your data doesn't pass through us.)*

**Single supporting line:**
"A maioria dos apps guarda seus dados nos servidores deles. Realwise não. Seus dados vivem na sua própria conta Google Firebase — você é o dono, nós somos só a ferramenta."

**3-step diagram (visual, minimal text):**

```
Você conecta Google     →     Firebase no seu Google     →     Realwise lê só quando você usa
     🔐                            ☁️                                  ⚡
```

**3 short benefit lines (icon + 5 words each):**
- 🔒 Você controla o acesso
- 📤 Pode exportar a qualquer momento
- 🛡️ Se Realwise fechar, seus dados continuam seus

**Visual:**
- Architecture diagram is the hero — copy is supporting
- Don't over-explain — trust the visual

**What we removed:** 4 paragraphs of architecture explanation, FAQ-style breakdowns.

---

### 3.7 PRODUCT IN ACTION

**Headline:**
"Veja na prática."
*(See it in action.)*

**3 scenes — each is just a screenshot + one caption line:**

#### **1. Do caos à clareza**
- Screenshot: Dashboard with organized transactions
- Caption: "Importe o extrato. Organize em minutos."

#### **2. Padrões que você não via**
- Screenshot: Charts and category breakdown
- Caption: "Entenda pra onde vai seu dinheiro."

#### **3. Controle do que importa**
- Screenshot: Bills, cards, budget allocation
- Caption: "Contas, cartões, orçamento. Tudo num só lugar."

**Visual:**
- Premium device mockups, generous whitespace
- Neon green/cyan glow on key data points
- Caption below screenshot, max 6 words
- Optional: subtle fade-in animation as user scrolls

**What we removed:** Multi-sentence captions, before/after framing copy, long descriptions of what each scene shows.

---

### 3.8 COMPARISON

**Headline:**
"Realwise vs. apps de assinatura."

**Single tight table (8 rows, no callouts):**

| | Realwise | Apps de assinatura |
|---|---|---|
| Pagamento | Uma vez | Todo mês, para sempre |
| 10 anos de uso | R$ 479,88 | R$ 1.200–4.800 |
| Renovação automática | Nunca | Sempre |
| Seus dados ficam | No seu Google | Nos servidores deles |
| Se o preço subir | Não te afeta | Você paga mais ou sai |
| Se a empresa fechar | Seus dados continuam | Você perde tudo |
| Suporte | Vitalício | Enquanto pagar |
| Liberdade pra sair | Total | Você perde acesso |

**One closing line below table:**
"Não é só mais barato. É um modelo diferente."
*(Not just cheaper. A different model.)*

**Visual:**
- Realwise column: neon green accent (background tint + bold)
- Subscription column: muted gray
- No psychological callout boxes (the table speaks)

**What we removed:** 4 psychological callout boxes, redundant copy.

---

### 3.9 PRICING

**Headline:**
"Uma decisão. Para sempre."
*(One decision. Forever.)*

**Single pricing card — structured for scanning:**

#### **Top**
- Badge: "Pagamento único"
- Title: "Acesso vitalício"

#### **Price (center, large)**
**R$ 479,88**
*ou 12x de R$ 39,99*

#### **Below price (3 short comparison lines)**
- Apps de assinatura em 10 anos: **R$ 1.200 – 4.800**
- Realwise em 10 anos: **R$ 479,88**
- Você economiza: **R$ 720 – 4.320+**

#### **What's included (one line each, no descriptions)**
- ✓ Dashboard, transações, contas, cartões
- ✓ Importação de extrato (Nubank, Itaú, Bradesco)
- ✓ Planejador, orçamento, investimentos
- ✓ Seus dados no seu Google Firebase
- ✓ Suporte por e-mail, vitalício
- ✓ Atualizações de segurança, sempre grátis

#### **CTA Button**
"Assumir o controle"
*(Subtext: "Pagamento seguro via Stripe")*

#### **Trust strip (below CTA, small icons + text)**
🔒 Stripe · 🇧🇷 PT-BR · 📱 Desktop + Mobile · 🔐 Dados 100% seus

**Visual:**
- Single elevated card, dark with neon green accent on price
- Generous internal spacing
- Comparison block visually distinct (lighter background tint)

**What we removed:** Reassurance paragraphs (moved to FAQ), ASCII art box, repeated bullet lists.

---

### 3.10 FAQ

**Headline:**
"Perguntas frequentes."

**6 questions only — cut from 10, picked the highest-leverage ones:**

---

**Q1: Por que não é uma assinatura?**

Apps de finanças não mudam toda semana — não faz sentido cobrar todo mês. Você compra uma vez, usa para sempre. Sem renovação, sem aumento de preço, sem dependência.

---

**Q2: Vou realmente usar? Já abandonei outros apps.**

Setup em 5 minutos. Dashboard mostra valor imediato — você vê seus padrões de gasto desde o primeiro dia. E sem mensalidade, você não tem culpa de "não usar o suficiente."

---

**Q3: Como meus dados ficam seguros?**

Seus dados vivem no seu próprio projeto Firebase (infraestrutura do Google). Realwise não tem servidor central com seus dados. Você controla as permissões e pode exportar quando quiser.

---

**Q4: E se Realwise fechar?**

Seus dados continuam no seu Firebase — você é o dono. Pode acessá-los pela API do Google, migrar pra outro app, ou usar como quiser. Você nunca dependeu de nós.

---

**Q5: Funciona no celular?**

Sim. É um PWA — você instala como um app normal no Android ou iPhone. Funciona offline e sincroniza quando conecta.

---

**Q6: Diferença pra Mobills, YNAB, Organizze?**

Eles são assinatura — você paga enquanto usa. Realwise é compra única — você é dono. Seus dados ficam com você, não com eles. Em 5 anos, você gastou R$600–2.400 com eles e R$479,88 com a gente. Uma vez.

---

**Visual:**
- Clean accordion (collapsed by default)
- One question per row
- Answer in 2-3 sentences max

**What we removed:**
- Questions 4 cut to 6 (the right amount)
- Long comparison table inside Q3 (overkill — main comparison is its own section)
- Multi-paragraph answers reduced to scannable 2-3 sentences

---

### 3.11 FINAL CTA

**Headline:**
"Pare de alugar. Comece a possuir."
*(Stop renting. Start owning.)*

**One supporting line:**
"Compre uma vez. Use para sempre. Seus dados, seu controle."

**CTA Button (large):**
"Assumir o controle"
*(Subtext: "R$ 479,88 · Pagamento único · Acesso vitalício")*

**Below button (small, single line):**
"Dúvidas? envie um e-mail. Resposta em 24h."

**Visual:**
- Large dark section with gradient (green → cyan)
- Generous whitespace, oversized headline
- Single elevated CTA button
- No 3-pillar reassurance cards (already covered in Comparison + Pricing)

**What we removed:** 3 reassurance pillar cards (redundant with earlier sections), multi-line subhead.

---

### 3.12 FOOTER

**Tagline update:**
Current: "Controle financeiro do jeito certo."
New: "Seu sistema financeiro. Seus dados. Para sempre."

**Trust statement:**
"© 2026 Realwise. Seus dados são 100% seus."

**Links:** Funcionalidades · Preço · FAQ · Contato

**No changes** to layout or links beyond above text updates.

---

## 4. WHAT CHANGED FROM PREVIOUS DRAFT

| Change | Why |
|---|---|
| Narrowed anti-subscription to *finance apps* | Avoid alienating users who happily pay Netflix/Spotify |
| Removed AI auto-categorization | Feature not enabled — don't promise what we don't ship |
| Cut copy ~40% across all sections | Reduce reading fatigue, increase scannability |
| Removed redundant reassurance cards | Same point shouldn't appear 3 times across sections |
| FAQ: 10 → 6 questions | Picked highest-leverage; cut redundancy |
| Pain Points: removed inline solutions | Page itself is the solution — don't repeat |
| Hero: single image, single CTA, single trust strip | Less is more |

---

## 5. IMPLEMENTATION SCOPE

**Components to modify:**
- `HeroSection.jsx` — new headline, subhead, CTA, simpler visual
- `PainPointsSection.jsx` — 4 pain quotes, no solutions
- `FeaturesSection.jsx` — 3 clusters, 9 features, one-line each
- `WhyRealwiseSection.jsx` — tighter comparison table, remove callouts
- `PricingSection.jsx` — value-stacked card with comparison block
- `FAQSection.jsx` — 6 questions, shorter answers
- `FooterSection.jsx` — tagline + trust statement

**New components:**
- `SubscriptionTrapSection.jsx` — finance-specific argument with stat band
- `DataOwnershipSection.jsx` — architecture diagram + 3 benefits
- `ProductShowcaseSection.jsx` — 3 cinematic scenes (may reuse existing screenshot logic)
- `FinalCTASection.jsx` — empowerment closer

**Page assembly:**
- `home.jsx` — new section order

**Constraints:**
- Work on `main` directly (no commits)
- Preserve unstaged changes
- Keep existing color tokens, fonts, spacing scale — refine, don't replace
- All copy in PT-BR
- No AI categorization claims anywhere

---

## 6. SUCCESS CRITERIA

✓ A first-time visitor can grasp the core pitch (ownership + one-time payment) within 5 seconds of the hero
✓ Total page reading time: under 3 minutes for full scan
✓ Each section communicates one clear idea
✓ No section repeats a point made earlier
✓ Anti-subscription argument is narrow and defensible (finance-specific)
✓ No claims made about features that aren't shipped
✓ Mobile-first scanning works (single column, generous spacing)
✓ Premium fintech aesthetic preserved (dark, neon green/cyan, calm)

---

## 7. NEXT STEPS

1. User reviews this revised spec
2. Invoke `writing-plans` skill to produce implementation plan
3. Execute plan (component rewrites + new sections)
4. Manual QA on desktop + mobile
