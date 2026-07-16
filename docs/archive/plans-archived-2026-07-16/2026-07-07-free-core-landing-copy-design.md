# Free-Core Landing Copy Design

**Date:** 2026-07-07

## Goal

Make the public Realwise landing page explain the current product truth clearly: people can start for free, manual entry and import stay free, and Premium unlocks planning, bills, investments, and advanced spending guidance after a 45-day premium access period.

## Current Problem

The current public landing still mixes older sales-funnel language with the newer free-core model. It also still contains outdated infrastructure claims like "your own Firebase" even though the product now runs on shared Realwise infrastructure. That creates two kinds of confusion:

- visitors may think the whole app is paid from day one
- visitors may think data architecture works differently than it actually does

## Design Direction

Keep the existing landing layout and visuals, but rewrite the high-intent sections so the free-versus-premium proposal is obvious.

### Messaging Principles

- Lead with `Comece grátis`
- Say exactly what is free forever: manual entry and import
- Say exactly what is premium: planning, bills, investments, and "quanto ainda pode gastar"
- Explain the 45-day premium access window as applying to premium features only, not the whole app
- Remove any copy that suggests each user gets dedicated infra or a personal Firebase project

### Section Changes

- `HeroSection`: shift from "buy access" language to "start free" language
- `MobileDemo`: reinforce the immediate free value on first use
- `FeaturesSection`: split perception between free core and premium depth without changing layout structure
- `PricingSection`: frame the card as `Premium para quem quer ir além`, not the only way to use the product
- `FAQSection`: answer the three core objections directly: what is free, what is premium, and what happens after 45 days
- `FooterSection`: add a final reassurance that the core is free and Premium is optional

### CTA Direction

All primary landing CTAs should send the user to `/login` to start using the product, instead of opening an immediate purchase flow.

## Success Criteria

- a new visitor understands the app can be used for free
- a new visitor understands Premium applies only to advanced features
- a new visitor understands the 45-day window applies to Premium, not the entire app
- the page no longer makes inaccurate claims about per-user infrastructure
