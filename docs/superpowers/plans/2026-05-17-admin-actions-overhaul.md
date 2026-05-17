# Admin Actions Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-row action buttons in LeadsDashboard with a single "Ações" dropdown menu (with descriptions and timing badges), and add an `onNewLead` Cloud Function that emails `leads@realwise.com.br` when a new lead is created.

**Architecture:** New `ActionsDropdown` component replaces inline buttons. Each action maps to an existing callable function or navigation path. Cloud Function uses a Firestore `onCreate` trigger on the `leads` collection, sends a simple notification email via existing Nodemailer setup.

**Tech Stack:** React 19, Firebase Callable Functions, Tailwind CSS v4, Node.js Cloud Functions, Nodemailer.

**Spec:** `docs/superpowers/specs/2026-05-17-admin-actions-overhaul-design.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/pages/admin/ActionsDropdown.jsx` | Per-row actions dropdown with descriptions and timing badges |
| Modify | `src/pages/admin/LeadsDashboard.jsx` | Replace inline action buttons with ActionsDropdown |
| Modify | `functions/emailTemplates.js` | Add `newLeadTemplate` |
| Modify | `functions/index.js` | Add `onNewLead` Firestore trigger |

---

## Task 1: Build `ActionsDropdown` Component

**Files:**
- Create: `src/pages/admin/ActionsDropdown.jsx`

- [ ] **Step 1: Read the current action buttons in LeadsDashboard**

Read `src/pages/admin/LeadsDashboard.jsx`. Find:
- All per-row action buttons/handlers: Onboard, Email, state change, coupon, etc.
- What callable functions they invoke.
- What state they manage (loading, modal visibility, etc.).

List all actions with their current handlers so they can be re-mapped in the dropdown.

- [ ] **Step 2: Create the dropdown component**

```jsx
// src/pages/admin/ActionsDropdown.jsx
import { useState, useRef, useEffect } from 'react';

const ACTIONS = [
  // --- Emails ---
  {
    id: 'welcome',
    name: 'Enviar Boas-Vindas',
    description: 'Envia email de boas-vindas com próximos passos.',
    when: 'Após pagamento',
    group: 'email',
  },
  {
    id: 'access',
    name: 'Liberar Acesso',
    description: 'Email com link direto para o dashboard.',
    when: 'Após onboarding',
    group: 'email',
  },
  {
    id: 'coupon',
    name: 'Enviar Cupom',
    description: 'Email com oferta especial e link de checkout com desconto.',
    when: 'Lead frio',
    group: 'email',
  },
  {
    id: 'lastchance',
    name: 'Última Oferta',
    description: 'Email com desconto final e link direto para Stripe.',
    when: 'Após 7+ dias sem conversão',
    group: 'email',
  },
  // --- Operações ---
  {
    id: 'onboard',
    name: 'Iniciar Onboarding',
    description: 'Cria projeto Firebase e configura acesso.',
    when: 'Após pagamento',
    group: 'ops',
  },
  {
    id: 'migration',
    name: 'Aceite de Migração',
    description: 'Email com instruções para aceitar transferência de projeto.',
    when: 'Após onboarding',
    group: 'ops',
  },
  // --- Admin ---
  {
    id: 'state',
    name: 'Alterar Estado',
    description: 'Muda o estado do lead manualmente.',
    when: 'Qualquer momento',
    group: 'admin',
  },
];

const GROUP_LABELS = {
  email: 'Emails',
  ops: 'Operações',
  admin: 'Admin',
};

/**
 * Props:
 *   lead        — the lead object
 *   onAction(id, lead) — callback when user clicks an action
 *   loading     — set of action IDs currently in flight
 */
export default function ActionsDropdown({ lead, onAction, loading = new Set() }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const groups = ['email', 'ops', 'admin'];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1.5"
      >
        Ações
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {groups.map((group, gi) => {
            const groupActions = ACTIONS.filter(a => a.group === group);
            return (
              <div key={group}>
                {gi > 0 && <div className="border-t border-gray-100 dark:border-gray-700" />}
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {GROUP_LABELS[group]}
                </p>
                {groupActions.map(action => {
                  const isLoading = loading.has(action.id);
                  return (
                    <button
                      key={action.id}
                      disabled={isLoading}
                      onClick={() => { onAction(action.id, lead); setOpen(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                            {isLoading && (
                              <span className="inline-block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            )}
                            {action.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                            {action.description}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5 whitespace-nowrap mt-0.5">
                          {action.when}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="h-1" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/ActionsDropdown.jsx
git commit -m "feat: ActionsDropdown component with descriptions, groups, and timing badges"
```

---

## Task 2: Wire ActionsDropdown into LeadsDashboard

**Files:**
- Modify: `src/pages/admin/LeadsDashboard.jsx`

- [ ] **Step 1: Map existing actions to the new dropdown**

Read the current action handlers. The `onAction(id, lead)` callback needs to handle all 7 IDs:

```js
// ids: 'welcome' | 'access' | 'coupon' | 'lastchance' | 'onboard' | 'migration' | 'state'
```

Add state for loading and a state-change modal (if not already present):

```jsx
const [loadingActions, setLoadingActions] = useState({}); // { [leadId]: Set<actionId> }
const [stateEditLead, setStateEditLead] = useState(null);
```

- [ ] **Step 2: Implement the `handleAction` callback**

```jsx
async function handleAction(actionId, lead) {
  // Mark loading
  setLoadingActions(prev => ({
    ...prev,
    [lead.email]: new Set([...(prev[lead.email] || []), actionId]),
  }));

  try {
    switch (actionId) {
      case 'welcome': {
        // Use existing EmailModal or call sendWelcomeEmail callable directly
        // If there's an existing "send welcome" callable:
        const fn = httpsCallable(functions, 'sendWelcomeEmail');
        await fn({ email: lead.email, name: lead.name });
        showToast(`Email de boas-vindas enviado para ${lead.name}.`);
        break;
      }
      case 'access': {
        const fn = httpsCallable(functions, 'sendAccessEmail');
        await fn({ email: lead.email, name: lead.name, clientId: lead.email.split('@')[0] });
        showToast(`Email de acesso enviado para ${lead.name}.`);
        break;
      }
      case 'coupon': {
        const fn = httpsCallable(functions, 'sendAbandonedCheckoutEmail');
        await fn({ email: lead.email, stage: 2 });
        showToast(`Email com cupom enviado para ${lead.name}.`);
        break;
      }
      case 'lastchance': {
        const fn = httpsCallable(functions, 'sendAbandonedCheckoutEmail');
        await fn({ email: lead.email, stage: 3 });
        showToast(`Email de última oferta enviado para ${lead.name}.`);
        break;
      }
      case 'onboard': {
        navigate(`/admin/onboard?email=${encodeURIComponent(lead.email)}`);
        return; // navigation — don't clear loading
      }
      case 'migration': {
        const fn = httpsCallable(functions, 'sendMigrationEmail');
        await fn({ email: lead.email, name: lead.name });
        showToast(`Email de migração enviado para ${lead.name}.`);
        break;
      }
      case 'state': {
        setStateEditLead(lead);
        return;
      }
      default:
        break;
    }
  } catch (err) {
    showToast(`Erro: ${err.message}`, 'error');
  } finally {
    setLoadingActions(prev => {
      const s = new Set(prev[lead.email] || []);
      s.delete(actionId);
      return { ...prev, [lead.email]: s };
    });
  }
}
```

**Note:** `showToast` — check how toasts are already shown in `LeadsDashboard.jsx`. Use the same pattern. If no toast system exists, use a simple `alert()` for now.

- [ ] **Step 3: Replace inline action buttons with `ActionsDropdown` in the table row**

Find the JSX block that renders per-row action buttons. Replace it entirely with:

```jsx
import ActionsDropdown from './ActionsDropdown';

// In the table row:
<td className="px-4 py-3">
  <ActionsDropdown
    lead={lead}
    onAction={handleAction}
    loading={loadingActions[lead.email] || new Set()}
  />
</td>
```

Remove all the old per-row button elements.

- [ ] **Step 4: Keep the state-change modal**

If there was a state-change modal or inline select for `updateLeadState`, keep it. It's now triggered when `actionId === 'state'` sets `stateEditLead`. Render it conditionally:

```jsx
{stateEditLead && (
  <StateChangeModal
    lead={stateEditLead}
    functions={functions}
    onClose={() => setStateEditLead(null)}
  />
)}
```

If the state change was previously inline in each row, extract it into a small `StateChangeModal` component (or keep the existing modal if one exists).

- [ ] **Step 5: Test in dev server**

```bash
npm run dev
```

Navigate to `/admin`. Open the leads table. Verify:
- Each row has a single "Ações" button.
- Clicking opens the dropdown with all 7 actions.
- Each action shows name, description, and timing badge.
- Clicking "Iniciar Onboarding" navigates.
- Clicking an email action shows a loading spinner in the dropdown item.
- Toast appears on success.
- Dropdown closes on outside click.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/LeadsDashboard.jsx src/pages/admin/ActionsDropdown.jsx
git commit -m "feat: replace per-row admin action buttons with ActionsDropdown"
```

---

## Task 3: Add `newLeadTemplate` Email Template

**Files:**
- Modify: `functions/emailTemplates.js`

- [ ] **Step 1: Add the template function**

In `functions/emailTemplates.js`, add:

```js
export function newLeadTemplate({ name, email, whatsapp, createdAt }) {
  const formattedDate = createdAt
    ? new Date(createdAt.toDate?.() || createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const whatsappDisplay = whatsapp || 'não informado';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #10b981; padding: 20px 24px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; }
    .body { padding: 24px; }
    .field { margin-bottom: 12px; }
    .field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px; }
    .field-value { font-size: 15px; color: #1e293b; font-weight: 500; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .admin-link { color: #10b981; text-decoration: none; font-size: 13px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Novo lead no Realwise</h1>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">Nome</div>
        <div class="field-value">${name || '—'}</div>
      </div>
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value">${email || '—'}</div>
      </div>
      <div class="field">
        <div class="field-label">WhatsApp</div>
        <div class="field-value">${whatsappDisplay}</div>
      </div>
      <div class="field">
        <div class="field-label">Data/hora (Brasília)</div>
        <div class="field-value">${formattedDate}</div>
      </div>
    </div>
    <div class="footer">
      <a href="https://realwise.com.br/admin" class="admin-link">Ver no painel admin →</a>
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/emailTemplates.js
git commit -m "feat: newLeadTemplate for admin lead notification email"
```

---

## Task 4: Add `onNewLead` Cloud Function

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Find the existing email send utility in functions**

```bash
grep -n "nodemailer\|sendEmail\|transporter\|createTransport" functions/*.js
```

Note the pattern used to send emails (likely `transporter.sendMail(...)` with a shared `createTransporter()` helper). You'll reuse this.

- [ ] **Step 2: Add the `onNewLead` trigger**

In `functions/index.js`, add:

```js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { newLeadTemplate } from './emailTemplates.js';

export const onNewLead = onDocumentCreated('leads/{leadId}', async (event) => {
  const lead = event.data?.data();
  if (!lead) return;

  const { name, email, whatsapp, createdAt } = lead;

  if (!email) {
    console.warn('[onNewLead] Lead has no email, skipping notification');
    return;
  }

  try {
    const transporter = createTransporter(); // reuse existing helper
    await transporter.sendMail({
      from: `"Realwise" <${process.env.EMAIL_USER}>`,
      to: 'leads@realwise.com.br',
      subject: `[Realwise] Novo lead: ${name || email}`,
      html: newLeadTemplate({ name, email, whatsapp, createdAt }),
    });
    console.log(`[onNewLead] Notification sent for lead: ${email}`);
  } catch (err) {
    console.error('[onNewLead] Failed to send notification:', err);
    // Don't rethrow — a failed notification shouldn't fail the trigger
  }
});
```

**Note:** Check if the project uses Firebase Functions v1 (`functions.firestore.document`) or v2 (`onDocumentCreated`). Match the existing pattern in `functions/index.js`. If v1:

```js
// v1 pattern:
exports.onNewLead = functions.firestore.document('leads/{leadId}').onCreate(async (snap, context) => {
  const lead = snap.data();
  // ... same body
});
```

- [ ] **Step 3: Deploy the function**

```bash
firebase deploy --only functions:onNewLead
```

- [ ] **Step 4: Test the trigger**

Create a test lead document in the `leads` collection via Firestore console or via the landing page form. Check:
- Email arrives at `leads@realwise.com.br`.
- Subject: `[Realwise] Novo lead: {name}`.
- Body shows name, email, whatsapp, date/time.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: onNewLead Cloud Function — emails leads@realwise.com.br on new lead creation"
```
