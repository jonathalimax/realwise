# Admin Actions Overhaul — Design Specification

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Two changes to the admin interface:

1. **Replace per-row action buttons with a single "Ações" dropdown** in `LeadsDashboard.jsx`, with descriptions and recommended-timing badges for each action.
2. **New `onNewLead` Cloud Function** — Firestore trigger that emails `leads@realwise.com.br` whenever a new document is created in the `leads` collection.

---

## 1. Admin Actions Dropdown

### Problem

`LeadsDashboard.jsx` currently has individual buttons per row (Onboard, Email, state change). As the action set grows (coupon email, last chance, migration, etc.), this becomes cluttered and gives no guidance on when to use each action.

### Solution

Replace all per-row action buttons with a single **"Ações"** button that opens a dropdown menu. Each item has a name, description subtext, and a timing badge.

### Dropdown Component: `ActionsDropdown`

New component, inline in `LeadsDashboard.jsx` or extracted to `src/pages/admin/ActionsDropdown.jsx`.

**Visual structure per item:**
```
┌────────────────────────────────────────┐
│ [icon] Enviar Boas-Vindas              │
│        Envia email de boas-vindas com  │
│        próximos passos.      [Após pag.]│
└────────────────────────────────────────┘
```

Each item has:
- **Name** (`font-semibold`)
- **Description** (`text-sm text-gray-500 dark:text-gray-400`)
- **Timing badge** (`text-xs bg-gray-100 dark:bg-gray-700 rounded px-1`)

### Action Definitions

| ID | Name | Description | When badge | Handler |
|---|---|---|---|---|
| `welcome` | Enviar Boas-Vindas | Envia email de boas-vindas com próximos passos. | Após pagamento | Call `sendWelcomeEmail` callable |
| `access` | Liberar Acesso | Email com link direto para login. | Após onboarding | Call `sendAccessEmail` or existing access-granted flow |
| `coupon` | Enviar Cupom | Email com oferta especial e link de checkout com desconto. | Lead frio | Call `sendAbandonedCheckoutEmail({ email, stage: 2 })` |
| `lastchance` | Última Oferta | Email com desconto final e link direto para Stripe. | Após 7+ dias sem conversão | Call `sendAbandonedCheckoutEmail({ email, stage: 3 })` |
| `onboard` | Iniciar Onboarding | Cria projeto Firebase e configura acesso. | Após pagamento | Navigate to `/admin/onboard?email={email}` |
| `migration` | Aceite de Migração | Email com instruções para aceitar transferência de projeto. | Após onboarding | Call `sendMigrationEmail` or existing migration flow |
| `state` | Alterar Estado | Muda o estado do lead manualmente. | Qualquer momento | Open existing state-change modal / inline select |

### Dividers

Group actions with dividers:
- **Emails** (welcome, access, coupon, lastchance) — top group
- **Operations** (onboard, migration) — middle group
- **Admin** (state) — bottom group

### Loading & Confirmation States

- Actions that send emails show a loading spinner on the dropdown item while the callable is in flight.
- After success: close dropdown + show a toast ("Email enviado para {name}").
- After error: keep dropdown open + show inline error text below the item.
- Destructive or irreversible actions (none in this list, but state change) show a quick confirm step ("Confirmar alteração para '{newState}'?") inline in the dropdown before executing.

### Implementation Notes

- Use `@headlessui/react` `Menu` component if already a dependency; otherwise implement with a `useState` + `useRef` + click-outside hook (follow pattern from any existing dropdown in the codebase).
- The dropdown must work correctly in both light and dark mode from the start.
- Keep the existing state-change select/modal behavior — wrap it as an item in the dropdown, don't rebuild the state-change logic.

---

## 2. New Lead Notification — `onNewLead` Cloud Function

### Problem

When a lead fills out the landing page form, the admin currently has no real-time notification. The lead only surfaces when the admin opens the dashboard.

### Solution

A Firestore trigger on `leads/{leadId}` that fires on document create and sends an email to `leads@realwise.com.br`.

### Function: `onNewLead` in `functions/index.js`

```js
export const onNewLead = onDocumentCreated('leads/{leadId}', async (event) => {
  const lead = event.data.data();
  const { name, email, whatsapp, createdAt } = lead;

  await sendEmail({
    to: 'leads@realwise.com.br',
    subject: `[Realwise] Novo lead: ${name}`,
    html: newLeadTemplate({ name, email, whatsapp, createdAt }),
  });
});
```

### Email Template: `newLeadTemplate`

Simple informational email (no fancy design needed — internal only):

```
Novo lead cadastrado no Realwise.

Nome:      {name}
Email:     {email}
WhatsApp:  {whatsapp || "não informado"}
Data/hora: {formatted timestamp}

Ver no admin: https://realwise.com.br/admin
```

### Template Function

Add `newLeadTemplate({ name, email, whatsapp, createdAt })` to `functions/emailTemplates.js`. Use the existing base template style (green header) for visual consistency.

### Edge Cases

- If `whatsapp` is absent: show "não informado".
- If `email` is absent (shouldn't happen, but defensive): log a warning and skip sending.
- Function must be idempotent — Firestore triggers can fire more than once. Use `event.id` to track sent notifications in a `notified_leads` collection (or just accept rare duplicates, since this is internal-only).

**Recommendation:** Accept rare duplicates. The cost of a duplicate admin email is much lower than the complexity of idempotency tracking for an internal notification.

---

## 3. Dark Mode

`ActionsDropdown` must have full dark mode support from creation. Test in both modes before marking complete.

---

## Out of Scope

- Per-action audit log (tracking who sent which email when).
- Email delivery confirmation / bounce tracking.
- Lead scoring or automated state transitions.
- Bulk actions across multiple leads.
