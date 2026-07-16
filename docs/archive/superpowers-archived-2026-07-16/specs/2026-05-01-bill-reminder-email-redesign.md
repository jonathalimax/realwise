# Bill Reminder Email Redesign

**Date:** 2026-05-01  
**Status:** Approved

## Problem

1. Bill amounts and due dates are missing from the email — `dueDate` normalization only runs inside the enrichment `try` block, so if enrichment fails the raw Firestore Timestamp reaches the template and `formatDate` returns `—`. Bill `amount` may also be undefined in Firestore, rendering as `R$ 0,00`.
2. Email design is generic and easy to ignore.

## Goals

- Fix the data bugs so amount and date always display correctly.
- Redesign the template to a dark "Finance Dashboard" style that feels worth opening.
- No change to send frequency (daily for overdue + due today is correct).

## Bug Fixes

### dueDate normalization

Move `bill.dueDate = billDue.toISOString()` to **before** the enrichment `try` block (currently inside it). This ensures the template always receives a string date regardless of whether enrichment succeeds.

### amount fallback

`parseFloat(undefined)` already falls back to `R$ 0,00` in the template — no code change needed, but add a `console.warn` in `scheduledBillReminders` when a bill has no `amount` field so it's visible in logs.

## New Email Template — Dark Dashboard Style

### Visual structure

```
┌─────────────────────────────────────────┐
│ MONEYWISE              [dark #0f172a bg] │
│ Jonatha · Resumo Financeiro · 01 mai    │
│ 2 contas exigem atenção imediata        │
│ [2 ATRASADAS] [1 HOJE] [3 PRÓXIMAS]     │
├─────────────────────────────────────────┤
│ ● Nubank Fatura   venceu 25 abr · 6d   R$ 1.240,00 │
│ ● Aluguel         venceu 28 abr · 3d   R$ 2.500,00 │
│ ● Internet        vence hoje · 01 mai  R$   119,90 │
├─────────────────────────────────────────┤
│ Total pendente                R$ 3.859,90 (green)  │
│           [Ver Contas no Moneywise →]              │
└─────────────────────────────────────────┘
footer: unsubscribe hint
```

### Color coding

| Status    | Dot color | Amount color | Chip background |
|-----------|-----------|-------------|-----------------|
| Overdue   | `#ef4444` | `#fca5a5`   | `#450a0a`       |
| Due today | `#f59e0b` | `#fdba74`   | `#422006`       |
| Upcoming  | `#3b82f6` | `#93c5fd`   | `#1e3a5f`       |

### CTA link

`https://moneywise.web.app/{clientId}/bills` — clientId is not available in the Cloud Function context, so the button links to `https://moneywise.web.app` as a fallback (same as current behavior).

### Subject line

- Overdue: `⚠️ {N} conta(s) atrasada(s) · R$ {total}`
- Due today only: `📅 Vence hoje · R$ {total}`

Subject now includes total amount for instant context in inbox preview.

## Files Changed

- `functions/emailTemplates.js` — replace `billReminderTemplate` with dark dashboard version; update subject builder in `sendBillReminderEmail`
- `functions/index.js` — move `dueDate` normalization before enrichment block; add `console.warn` for missing amount

## Out of Scope

- Frequency changes
- Unsubscribe link (already handled via `settings.billReminders === false`)
- Per-client branding
