# Realwise — TODO (fixes & planned features)

Working backlog for improvements that don’t fit a single PR. **Order is priority-ish, not a promise.**

---

## 1. Enforce paid / plan features (entitlements)

**Problem:** Feature flags in `public/clients/{clientId}.json` only drive UI (`useFeature`). Firestore rules do not check those flags, so a user who already has Auth access could bypass the SPA and use gated surfaces (e.g. goals, investments) without matching what they paid for.

**Direction (pick one or combine):**

- **Firebase Custom Claims** — Set claims when purchase/onboarding completes (Cloud Function or Admin script); read claims in Firestore rules or callable endpoints.
- **Firestore entitlement doc** — e.g. `settings/{uid}` or `entitlements/{uid}` with `{ investments: true, goals: true, … }` maintained only via Functions/admin; rules deny writes to investments/goals/B3 callables unless allowed.
- **Callable gate** — Sensitive actions (B3 sync callable, etc.) already run server-side; extend checks there using Stripe/customer record or Firestore entitlement.

**Acceptance:** Gated collections or actions are denied server-side when the tenant/user is not entitled, independent of client-side JSON or React routing.

---

## 2. _(next items — add as you go)_

<!-- Examples when ready:
- Sidebar: hide Investments nav when `investments` flag false (avoid dead links).
- Wire `whatsapp` feature flag to UI if server-side behavior is added.
-->

---

## How to use this file

- Add new bullets under section 2 (or new numbered sections) with enough context for a future session.
- Link PRs or issues when they exist: `[#123](...)`.
