# Email System Redesign — Design Specification

**Date:** 2026-05-13  
**Author:** Claude Code  
**Status:** Approved

---

## Overview

This document outlines a comprehensive redesign of Realwise's email system to:
1. **Expand bill reminders** to include bills due 1-3 days ahead
2. **Add abandoned checkout recovery** with a 4h → 24h → 48h email sequence
3. **Unify email templates** using a consistent, professional design (green theme, dark mode)
4. **Fix lead status display** in the admin dashboard

**Impact:** Improved payment recovery (abandoned carts) + user notification accuracy + visual consistency.

---

## 1. Bill Reminder Enhancement

### Current Behavior
- Daily scheduled function runs at 9 AM (São Paulo time)
- Sends reminders ONLY for bills that are:
  - **Overdue** (due date in past)
  - **Due today**
- Users with bills due tomorrow don't receive notifications

### Problem Statement
User reported missing reminder for a bill due tomorrow. Current system only notifies for overdue/today bills, missing the 1-3 day advance notice window.

### New Behavior
- Reminders sent for bills in these categories:
  - **Overdue** (due date < today)
  - **Due today** (due date = today)
  - **Due soon** (due date = tomorrow through day+3)
  - *(Upcoming = day+4 onwards, not sent)*
- All other logic unchanged (9 AM São Paulo time, respects `billReminders` setting, enriches credit card amounts)

### Implementation Details

**File:** `functions/billReminders.js`

Update `collectUserBillGroups()` function signature:
```javascript
// OLD: groups = { overdue, dueToday, upcoming }
// NEW: groups = { overdue, dueToday, dueSoon, upcoming }
```

Logic change in grouping loop (around line 50):
- Keep overdue (due < today) and dueToday (due = today)
- Add dueSoon: bills due between tomorrow and day+3
- Remaining bills go to upcoming (not sent)

**File:** `functions/clientScheduledBillReminders.js`

Update `sendBillReminderEmail()`:
- Modify subject line to include dueSoon count if present
- Update email body to render dueSoon section with appropriate styling

**File:** `functions/emailTemplates.js`

Update `billReminderTemplate()`:
- Add rendering for dueSoon bills (blue chip, similar to upcoming but labeled "PRÓXIMA")
- Ensure all four sections render correctly with proper spacing

**Database:** No changes required (timestamp fields already exist)

---

## 2. Abandoned Checkout Recovery Sequence

### Problem Statement
Current Stripe webhook sends `welcomeTemplate` only after successful payment. We need to recover abandoned checkouts with targeted, timed coupon offers.

### Solution
A multi-stage email sequence targeting users who initiated checkout but didn't complete payment:

| Stage | Time | Condition | Email Type | Action |
|-------|------|-----------|------------|--------|
| 0 | Baseline | Checkout created | Create session record | Store metadata |
| 1 | +4h | Still pending/not_paid | Reminder | "You left something in your cart" |
| 2 | +24h | Still pending/not_paid | **Coupon** | Email username as code, valid 24h |
| 3 | +48h | Still pending/not_paid | Last chance | Same coupon, urgent messaging |
| ✓ | On payment | → paid | Welcome | Standard welcome email |

### Trigger Mechanism
**Stripe Checkout Session Lifecycle:**

1. **`checkout.session.created`** → Create `checkout_sessions` doc with:
   - `email` (customer_email)
   - `name` (metadata.name)
   - `createdAt` (server timestamp)
   - `stage` (0)
   - `lastSentAt` (null)

2. **Every 6 hours** → Scheduled function `abandonedCheckoutReminders`:
   - Query `checkout_sessions` where `stage < 3` and lead state is still pending/not_paid
   - For each session, calculate time elapsed since `createdAt`
   - If elapsed ≥ 4h and stage === 0 → send reminder email, set `stage = 1`, `lastSentAt = now`
   - If elapsed ≥ 24h and stage === 1 → send coupon email, set `stage = 2`
   - If elapsed ≥ 48h and stage === 2 → send last chance email, set `stage = 3`
   - Stop processing if lead state changes to paid (delete session)

3. **On Stripe payment success** → `stripeWebhook`:
   - Mark lead as paid/onboarding
   - Send welcome email immediately
   - Delete or mark `checkout_sessions` entry as complete

### Coupon Code Format

**Code:** Email username (local part)
- Example: `jonathalimax@gmail.com` → code `jonathalimax`
- Lowercase, alphanumeric only (no dots, dashes normalized)
- Valid for exactly 24 hours from email send time

**Storage in `coupons` collection:**
```javascript
{
  id: auto-generated,
  code: "jonathalimax",
  email: "jonathalimax@gmail.com",
  issuedAt: server timestamp,
  expiresAt: issuedAt + 24h,
  discountPercent: 10, // or configurable
  maxUses: 1,
  usedCount: 0,
  source: "abandoned_checkout", // track origin
}
```

**Validation:** Checkout form must verify:
- Code matches customer email username
- Current time < expiresAt
- usedCount < maxUses

### Manual Trigger

**Admin button in LeadsDashboard:**
- Add "Send Coupon Email" button next to each pending/not_paid lead
- On click: call new function `sendAbandonedCheckoutEmail(email, stage)`
- Stages: 1 = reminder, 2 = coupon, 3 = last chance
- Function creates/updates `checkout_sessions` entry with `lastSentAt = now`, increments stage

---

## 3. Email Template Unification

### Current Templates
- `welcomeTemplate()` — Light generic design, minimal styling
- `billReminderTemplate()` — Professional green theme, dark mode support, color-coded bill chips
- Other templates: `accessGrantedTemplate`, `acceptMigrationTemplate` (less used)

### New Approach

**All transactional emails share the `billReminderTemplate` base design:**
- Colors: Realwise green (#10b981) accent, slate gray text
- Dark mode: Automatic via `@media (prefers-color-scheme: dark)`
- Typography: Segoe UI, clean hierarchy
- Layout: 600px max width, centered, professional

**Template variants in `emailTemplates.js`:**

1. **`welcomeTemplate(name, loginUrl)`** (redesigned)
   - Title: "Bem-vindo ao Realwise, [name]! 🚀"
   - Body: Next steps (await activation, prepare docs, contact support)
   - CTA: "Acessar o Sistema Agora" → loginUrl
   - Uses billReminderTemplate base

2. **`checkoutReminderTemplate(name, cartUrl)`** (new)
   - Title: "Você deixou algo no carrinho, [name]!"
   - Body: Reminder with product/plan summary
   - CTA: "Continuar Checkout" → cartUrl
   - Visual: Yellow/warning color chip for timing

3. **`checkoutCouponTemplate(name, couponCode, discount, expiresAt, cartUrl)`** (new)
   - Title: "Seu cupom especial acabou de chegar! 🎁"
   - Body: Coupon code **prominent**, expiration time, discount details
   - CTA: "Usar Cupom e Finalizar" → cartUrl
   - Visual: Green coupon code box with monospace font

4. **`checkoutLastChanceTemplate(name, couponCode, expiresAt, cartUrl)`** (new)
   - Title: "Última chance: seu cupom expira em 24 horas ⏰"
   - Body: Urgency messaging, same coupon code, final offer
   - CTA: "Finalizar Compra Agora" → cartUrl
   - Visual: Red/urgent border on coupon code box

5. **`billReminderTemplate(name, { overdue, dueToday, dueSoon }, ctaUrl)`** (updated)
   - Add dueSoon section with blue chip, label "PRÓXIMA"
   - Render all four groups in priority order: overdue, dueToday, dueSoon, upcoming
   - Subject line includes counts: "⚠️ 1 atrasada · 📅 1 hoje · 🔵 2 próximas · R$ 1.234,56"

### Code Structure

**File:** `functions/emailTemplates.js`
- Keep existing `getBaseTemplate()` helper
- Update `billReminderTemplate()` to add dueSoon rendering
- Add `welcomeTemplate()` redesigned version
- Add three new checkout templates
- All use consistent SHARED_STYLES with dark mode

---

## 4. Admin Dashboard Fixes

### Issue: "Unknown" Lead Status

**Current behavior (LeadsDashboard.jsx, line 31):**
```javascript
state: data.state ?? (data.paid ? 'paid' : 'pending')
```

When `data.state` is undefined and `data.paid` is falsy, it defaults to 'pending'. But if both are falsy/undefined, it still shows 'pending' instead of an explicit "unknown" or error state.

**Fix:**
```javascript
state: data.state || (data.paid ? 'paid' : 'pending') || 'unknown'
```

Better: ensure all leads have an explicit state on creation. In `stripeWebhook.js`, always set state to one of the valid states at checkout creation.

### New UI: Manual Email Trigger

**Location:** LeadsDashboard.jsx, lead row actions

**Add buttons next to each pending/not_paid lead:**
- "Send Reminder" (stage 1)
- "Send Coupon" (stage 2)
- "Send Last Chance" (stage 3)

**Behavior:**
- Clicking updates checkout_sessions and sends email immediately
- Button disabled for paid/active leads
- Shows loading state + success toast

**Function call:**
```javascript
httpsCallable(functions, 'sendAbandonedCheckoutEmail')({
  email,
  stage: 2, // 1=reminder, 2=coupon, 3=lastChance
})
```

---

## 5. Cloud Functions Summary

### New Functions

1. **`abandonedCheckoutReminders`** (scheduled, every 6 hours)
   - Runs at: 12 AM, 6 AM, 12 PM, 6 PM (São Paulo time, suggested)
   - Logic: Query checkout_sessions, compare elapsed time, send emails based on stage
   - Sends up to 9 emails/day for 3 concurrent abandoned carts

2. **`sendAbandonedCheckoutEmail`** (callable)
   - Input: { email, stage }
   - Sends: reminder / coupon / last chance email
   - Updates: checkout_sessions stage + lastSentAt
   - Creates: coupon in coupons collection (for stage 2)

### Modified Functions

1. **`stripeWebhook`** (webhook)
   - On `checkout.session.created`: Create checkout_sessions entry
   - On `checkout.session.completed`: Send welcome email, delete checkout_sessions entry

2. **`clientScheduledBillReminders`** (scheduled)
   - Update collectUserBillGroups call to handle dueSoon bills
   - Update email template rendering for 4 sections
   - Update subject line to include dueSoon count

### Modified Files

- `functions/emailTemplates.js` — Add 4 new templates, update billReminderTemplate
- `functions/billReminders.js` — Add dueSoon grouping logic
- `functions/clientScheduledBillReminders.js` — Handle dueSoon in email send
- `functions/stripeWebhook.js` — Create checkout_sessions, send welcome on completion
- `src/pages/admin/LeadsDashboard.jsx` — Fix status display, add manual email buttons

---

## 6. Database Schema Changes

### New Collection: `checkout_sessions`

Purpose: Track abandoned checkout state for email sequencing

```javascript
{
  id: auto-generated,
  email: "user@example.com",
  name: "User Name",
  createdAt: timestamp,
  stage: 0, // 0=created, 1=reminder_sent, 2=coupon_sent, 3=last_chance_sent
  lastSentAt: timestamp, // when last email was sent
  cartUrl: "https://realwise.com.br/checkout?session=...", // optional
}
```

**Indexes:** None required (small dataset, simple queries)

### Updated Collection: `coupons`

Add new field:
- `source: "abandoned_checkout"` — to distinguish from other coupon types

---

## 7. Cost & Performance

### Scheduled Functions
- `abandonedCheckoutReminders`: Every 6 hours = 4 invocations/day, ~100ms each
- `clientScheduledBillReminders`: Already running, minimal added overhead

**Estimated cost:** <$0.10/month for 2-3 new users/day

### Email Volume
- 2-3 new users/day → 6-9 emails/day max (3 emails per abandoned checkout)
- Negligible SMTP load

### Database Size
- `checkout_sessions`: 100-200 documents max (old entries clean up after purchase or 72h inactivity)
- `coupons`: 50-100 active at any time

---

## 8. Success Criteria

✅ Bill reminders sent for bills due 1-3 days ahead  
✅ Abandoned checkout recovery emails sent at 4h, 24h, 48h  
✅ Coupon codes tied to email username, valid 24h  
✅ Manual email trigger works in admin dashboard  
✅ All emails use consistent green theme + dark mode  
✅ Lead status display shows pending/not_paid correctly  
✅ Welcome email sent immediately after purchase  
✅ Cost remains negligible (<$0.10/month)

---

## 9. Out of Scope

- SMS reminders (email only)
- Coupon customization UI (admin sets discount % globally)
- A/B testing email subject lines (future optimization)
- Email unsubscribe links (existing compliance handled elsewhere)
