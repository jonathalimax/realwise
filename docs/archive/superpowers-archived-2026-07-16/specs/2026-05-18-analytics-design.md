# Analytics & Conversion Tracking — Design Spec
**Date:** 2026-05-18  
**Status:** Approved

## Overview

Full analytics coverage for the Realwise landing page: UTM-attributed short links, behavioral event tracking, checkout funnel instrumentation, partial lead capture on abandon, and an admin dashboard funnel panel. All events route to GA4. Business-critical funnel counts also write to Firestore for the Admin dashboard.

---

## 1. Short Link Redirects

**Mechanism:** Firebase Hosting static redirects in `firebase.json`. No Cloud Function, no latency.

| Slug | Destination |
|---|---|
| `/go/whatsapp` | `/?utm_source=whatsapp&utm_medium=social&utm_campaign=launch` |
| `/go/instagram` | `/?utm_source=instagram&utm_medium=social&utm_campaign=launch` |
| `/go/bio` | `/?utm_source=instagram&utm_medium=bio&utm_campaign=launch` |
| `/go/email` | `/?utm_source=email&utm_medium=newsletter&utm_campaign=launch` |

All are 301 redirects. Adding a new campaign = one line in `firebase.json` + hosting-only deploy (~10s).

---

## 2. GA4 Setup on Landing Page

- Add GA4 `gtag.js` script to `landing_page/pages/home.jsx` using the existing Measurement ID from `src/utils/analytics.js`.
- UTM params are read once at page load by `landingAnalytics.js` and stored in module scope, attached as extra properties to every subsequent event.

---

## 3. `landing_page/landingAnalytics.js`

Single module. No external dependency beyond `window.gtag`. All functions are no-ops if gtag is not loaded (safe for dev).

### Init

```js
landingAnalytics.init(measurementId)
```

- Bootstraps gtag
- Reads and stores `utm_source`, `utm_medium`, `utm_campaign` from `window.location.search`
- Attaches scroll depth listener firing at 25 / 50 / 75 / 100% (each milestone fires once per page load)

### Page Behavior Events → GA4 only

| Function | GA4 Event | Extra Properties |
|---|---|---|
| `trackSectionViewed(sectionName)` | `section_viewed` | `section_name`, utm params |
| `trackCtaClicked(label, section)` | `cta_clicked` | `cta_label`, `section`, utm params |
| _(scroll listener, internal)_ | `scroll_depth` | `depth` (25\|50\|75\|100), utm params |

**Section visibility:** `IntersectionObserver` at ≥50% threshold. A `Set` of already-seen sections prevents duplicate fires on scroll-back.

**Sections to instrument:** Hero, PainPoints, Benefits, Features, ProductShowcase, WhyRealwise, Footer (each gets a `data-section` attribute for the observer to read).

### Checkout Funnel Events → GA4 only

| Function | GA4 Event | Extra Properties |
|---|---|---|
| `trackCheckoutOpened(section)` | `checkout_opened` | `section` (which CTA triggered it), utm params |
| `trackCheckoutClosed(reason, fieldsFilled)` | `checkout_closed` | `reason` (backdrop\|button), `fields_filled` (count 0–3) |
| `trackFieldFocused(fieldName)` | `checkout_field_focused` | `field_name` (name\|email\|whatsapp) |
| `trackFieldCompleted(fieldName)` | `checkout_field_completed` | `field_name` |
| `trackFormSubmitted()` | `checkout_submitted` | utm params |
| `trackFormError(errorType)` | `checkout_error` | `error_type` (validation\|api), utm params |

---

## 4. Partial Lead Capture

**Trigger:** `CheckoutModal` — on email field `onBlur` when email passes format validation.  
**Secondary trigger:** whatsapp field `onBlur` when filled (updates existing partial lead).

### New Cloud Function: `savePartialLead`

- **Input:** `{ email, name?, whatsapp?, utmSource? }`
- **Behavior:** Upsert `leads/{email}` with:
  - `state: 'form_partial'` — only if no lead exists yet; never downgrades `checkout_started` or `paid`
  - `source: utmSource` (stored for channel attribution)
  - `updatedAt: serverTimestamp()`
  - `createdAt: serverTimestamp()` on first write
- Also increments `landing_stats/{YYYY-MM-DD}.partial_leads` and `landing_stats/{YYYY-MM-DD}.sources.{utmSource}` using `FieldValue.increment(1)`

### `onNewLead` trigger guard

The existing Firestore trigger (`functions/index.js:634`) sends an admin email on new lead. Add a state check: only send notification when `state !== 'form_partial'` to avoid noise from partial leads.

### Lead state progression

```
form_partial → checkout_started → paid
```

`checkout_started` is set by the existing `createCheckoutSession` function (unchanged).  
`createCheckoutSession` also increments `landing_stats/{YYYY-MM-DD}.checkout_started`.

---

## 5. `landing_stats` Firestore Collection

**Location:** Central admin project (same as `leads`).  
**Document ID:** `YYYY-MM-DD` (one doc per day).

```
partial_leads:     number   // incremented by savePartialLead
checkout_started:  number   // incremented by createCheckoutSession
sources: {
  whatsapp:   number
  instagram:  number
  email:      number
  direct:     number        // fallback when utm_source is absent
}
```

`paid` count is derived at read time from the `leads` collection filtered by `paid: true` and `updatedAt` within the date range — no need to duplicate it.

---

## 6. Admin Dashboard Funnel Panel

**File:** `src/pages/admin/LeadsDashboard.jsx`

Add a collapsible panel above the leads table showing last 7 days:

- **Funnel bar:** Partial leads → Checkout started → Paid (with conversion % between each step)
- **Source breakdown:** Row per UTM source showing partial lead count

Data source: read `landing_stats` docs for the last 7 days, sum counters client-side.

---

## Files Changed

| File | Change |
|---|---|
| `firebase.json` | Add 4 redirect rules under `"redirects"` |
| `landing_page/pages/home.jsx` | Add GA4 script tag, call `landingAnalytics.init()` |
| `landing_page/landingAnalytics.js` | **New** — all tracking functions |
| `landing_page/components/landing/CheckoutModal.jsx` | Add field blur handlers, call tracking functions |
| `landing_page/components/landing/HeroSection.jsx` + others | Add `data-section` attributes, call `trackCtaClicked` |
| `functions/index.js` | Add `savePartialLead` export; add state guard to `onNewLead` |
| `functions/createCheckoutSession.js` | Add `landing_stats` increment on checkout start |
| `src/pages/admin/LeadsDashboard.jsx` | Add funnel panel reading `landing_stats` |

---

## Out of Scope

- GA4 Data API integration (behavioral data analyzed directly in GA4)
- Heatmaps or session replays (PostHog not in scope)
- SMS/WhatsApp follow-up automation for partial leads
