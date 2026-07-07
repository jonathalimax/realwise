# Free-Core Landing Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the live public landing page so it accurately explains the free-core and premium Realwise model.

**Architecture:** Keep the current landing layout and section order, but rewrite the real rendered landing components under `apps/web/landing_page/components/landing/`. Align all landing CTAs to the start-free path and remove outdated infrastructure promises.

**Tech Stack:** React, Vite, Framer Motion, existing landing page components

---

### Task 1: Update Start-Free CTAs

**Files:**
- Modify: `apps/web/landing_page/components/landing/HeroSection.jsx`
- Modify: `apps/web/landing_page/components/landing/MobileDemo.jsx`
- Modify: `apps/web/landing_page/components/landing/PricingSection.jsx`
- Modify: `apps/web/landing_page/components/landing/FinalCTASection.jsx`

**Step 1:** Replace checkout-first copy with start-free copy.

**Step 2:** Make each CTA redirect to `/login`.

**Step 3:** Keep analytics tracking, but rename tracked CTA labels to match the new copy.

### Task 2: Rewrite Landing Content

**Files:**
- Modify: `apps/web/landing_page/components/landing/HeroSection.jsx`
- Modify: `apps/web/landing_page/components/landing/FeaturesSection.jsx`
- Modify: `apps/web/landing_page/components/landing/PricingSection.jsx`
- Modify: `apps/web/landing_page/components/landing/FAQSection.jsx`
- Modify: `apps/web/landing_page/components/landing/FooterSection.jsx`

**Step 1:** Add explicit free-core language.

**Step 2:** Add explicit premium-feature language.

**Step 3:** Remove outdated infra claims and replace them with accurate, neutral statements.

### Task 3: Verify The Live Landing Build

**Files:**
- Verify: `apps/web/landing_page/pages/home.jsx`

**Step 1:** Run `pnpm --dir apps/web build`

**Step 2:** Confirm the build passes without regressions.

### Task 4: Commit And Push

**Step 1:** Stage only the landing-copy and doc changes.

**Step 2:** Commit with a message describing the landing clarification.

**Step 3:** Push `main` to `origin`.
