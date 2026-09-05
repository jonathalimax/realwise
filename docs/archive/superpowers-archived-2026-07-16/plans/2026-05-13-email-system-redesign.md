# Email System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand bill reminders to 1-3 days ahead, add abandoned checkout recovery emails (4h/24h/48h), unify all email templates using the green/dark-mode design, and fix lead status display in admin.

**Architecture:** New `abandonedCheckoutEmails.js` module owns the recovery sequence logic — a 6-hourly scheduled function scans `checkout_sessions` by stage and elapsed time, a callable function handles manual triggers. All templates share the existing `getBaseTemplate()` from `emailTemplates.js`. Stripe webhook gains a second handler branch for `checkout.session.created`.

**Tech Stack:** Firebase Functions v1, Firestore, Nodemailer (Umbler SMTP), Stripe webhook, React 19 admin dashboard.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `functions/emailTemplates.js` | Add 3 checkout templates, redesign `welcomeTemplate`, update `billReminderTemplate` with dueSoon |
| Modify | `functions/billReminders.js` | Add `dueSoon` bill group (due 1-3 days) |
| Modify | `functions/clientScheduledBillReminders.js` | Send on dueSoon bills, update subject |
| Create | `functions/abandonedCheckoutEmails.js` | Scheduled recovery + callable manual trigger |
| Modify | `functions/stripeWebhook.js` | Handle `checkout.session.created`, use new welcome template |
| Modify | `functions/index.js` | Export new functions, use updated templates |
| Modify | `src/pages/admin/LeadsDashboard.jsx` | Fix unknown status, add recovery email buttons |

---

## Task 1: Update Email Templates

**Files:**
- Modify: `functions/emailTemplates.js`

- [ ] **Step 1: Redesign `welcomeTemplate` using `getBaseTemplate`**

Replace the existing `exports.welcomeTemplate` (currently around line 68) with:

```javascript
exports.welcomeTemplate = (name, loginUrl = 'https://realwise.com.br') => getBaseTemplate({
  title: `Bem-vindo ao Realwise, ${name}! 🚀`,
  subtitle: 'Sua jornada para uma vida financeira mais organizada começa agora.',
  body: `
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">Próximos Passos</div>
      <div class="mw-info-text" style="font-size:13px;color:#374151;line-height:1.7;">
        <div style="margin-bottom:6px;">⏳ <strong>Aguarde a Ativação</strong> — nossa equipe está configurando seu acesso e você receberá um e-mail em instantes.</div>
        <div style="margin-bottom:6px;">📄 <strong>Prepare-se</strong> — reúna suas faturas e extratos bancários.</div>
        <div>💬 <strong>Dúvidas?</strong> Basta responder a este e-mail.</div>
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;">Obrigado por confiar no Realwise!<br><br>Equipe Realwise</div>
  `,
  cta: 'Acessar o Sistema Agora',
  ctaUrl: loginUrl,
  footerNote: 'Você está recebendo este e-mail porque se cadastrou no Realwise.',
});
```

- [ ] **Step 2: Add `checkoutReminderTemplate`**

Append after the updated `welcomeTemplate`:

```javascript
exports.checkoutReminderTemplate = (name, cartUrl = 'https://realwise.com.br') => getBaseTemplate({
  title: `Você deixou algo no carrinho, ${name}!`,
  subtitle: 'Ainda dá tempo de garantir seu acesso ao Realwise.',
  body: `
    <div class="mw-warn-box" style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div class="mw-warn-text" style="font-size:13px;color:#713f12;line-height:1.7;">
        ⏰ <strong>Sua sessão ainda está ativa.</strong> Complete o checkout agora e comece a organizar suas finanças hoje mesmo.
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;">
      Com o Realwise você centraliza contas, cartões, investimentos e metas em um só lugar.<br><br>
      Clique no botão abaixo para continuar de onde parou.
    </div>
  `,
  cta: 'Continuar Checkout',
  ctaUrl: cartUrl,
  footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
});
```

- [ ] **Step 3: Add `checkoutCouponTemplate`**

```javascript
exports.checkoutCouponTemplate = (name, couponCode, discountPercent = 10, expiresAt, cartUrl = 'https://realwise.com.br') => {
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '24 horas';
  return getBaseTemplate({
    title: `Seu cupom especial chegou, ${name}! 🎁`,
    subtitle: `${discountPercent}% de desconto exclusivo para você. Válido por 24 horas.`,
    body: `
      <div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;border:2px dashed #10b981;border-radius:8px;padding:16px 32px;background:#ecfdf5;">
          <div style="font-size:11px;font-weight:700;color:#065f46;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu Cupom</div>
          <div style="font-size:28px;font-weight:800;color:#10b981;letter-spacing:4px;font-family:monospace;">${couponCode.toUpperCase()}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px;">Expira em ${expiresStr}</div>
        </div>
      </div>
      <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;text-align:center;">
        Use este código no checkout e ganhe <strong>${discountPercent}% de desconto</strong>.<br>
        Este cupom é exclusivo para o e-mail com que você se cadastrou.
      </div>
    `,
    cta: 'Usar Cupom e Finalizar',
    ctaUrl: cartUrl,
    footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
  });
};
```

- [ ] **Step 4: Add `checkoutLastChanceTemplate`**

```javascript
exports.checkoutLastChanceTemplate = (name, couponCode, expiresAt, cartUrl = 'https://realwise.com.br') => {
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'em breve';
  return getBaseTemplate({
    title: `Última chance: cupom expira às ${expiresStr} ⏰`,
    subtitle: 'Não perca seu desconto exclusivo. Esta é a última vez que vamos lembrar.',
    body: `
      <div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;border:2px dashed #ef4444;border-radius:8px;padding:16px 32px;background:#fef2f2;">
          <div style="font-size:11px;font-weight:700;color:#991b1b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu Cupom</div>
          <div style="font-size:28px;font-weight:800;color:#ef4444;letter-spacing:4px;font-family:monospace;">${couponCode.toUpperCase()}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:6px;">⚠️ Expira ${expiresStr}</div>
        </div>
      </div>
      <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;text-align:center;">
        Este é o último aviso. Após o vencimento, o cupom expira definitivamente.<br>
        O Realwise continua disponível — só não a este preço.
      </div>
    `,
    cta: 'Finalizar Compra Agora',
    ctaUrl: cartUrl,
    footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
  });
};
```

- [ ] **Step 5: Update `billReminderTemplate` to add `dueSoon` support**

In the existing `billReminderTemplate` function, find where `chips` are built (around line 136). Add a dueSoon chip:

```javascript
// OLD:
const chips = [
  overdueCount > 0 ? `<span class="chip-overdue" ...>` : '',
  dueTodayCount > 0 ? `<span class="chip-today" ...>` : '',
  upcomingCount > 0 ? `<span class="chip-upcoming" ...>` : '',
].filter(Boolean).join('');

// NEW — add dueSoon param and chip:
exports.billReminderTemplate = (name, { overdue, dueToday, dueSoon, upcoming }, ctaUrl = 'https://realwise.com.br') => {
```

Also update `grandTotal` and `chips` sections:

```javascript
  const dueSoonCount = (dueSoon || []).length;

  const grandTotal = [...(overdue || []), ...(dueToday || []), ...(dueSoon || []), ...(upcoming || [])].reduce((sum, b) => {
    const amt = parseFloat(getDisplayAmount(b));
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const chips = [
    overdueCount > 0 ? `<span class="chip-overdue" style="background:#fee2e2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${overdueCount} ATRASADA${overdueCount > 1 ? 'S' : ''}</span>` : '',
    dueTodayCount > 0 ? `<span class="chip-today" style="background:#fef3c7;color:#d97706;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueTodayCount} HOJE</span>` : '',
    dueSoonCount > 0 ? `<span class="chip-upcoming" style="background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueSoonCount} PRÓXIMA${dueSoonCount > 1 ? 'S' : ''}</span>` : '',
    upcomingCount > 0 ? `<span style="background:#f3f4f6;color:#6b7280;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;display:inline-block;">${upcomingCount} FUTURA${upcomingCount > 1 ? 'S' : ''}</span>` : '',
  ].filter(Boolean).join('');
```

And update `allRows` to include `dueSoon`:

```javascript
  const allRows = [
    renderRows(overdue, '#ef4444', '#dc2626', true),
    renderRows(dueToday, '#f59e0b', '#d97706', false),
    renderRows(dueSoon || [], '#3b82f6', '#2563eb', false),
    renderRows(upcoming, '#6b7280', '#9ca3af', false),
  ].join('');
```

- [ ] **Step 6: Commit**

```bash
git add functions/emailTemplates.js
git commit -m "feat: redesign email templates — add checkout recovery templates, update bill reminder with dueSoon"
```

---

## Task 2: Expand Bill Reminders to 1-3 Days Ahead

**Files:**
- Modify: `functions/billReminders.js`

- [ ] **Step 1: Update `collectUserBillGroups` to add `dueSoon` group**

In `functions/billReminders.js`, update the date boundary variables at the top of `collectUserBillGroups` and add the `dueSoon` bucket:

```javascript
async function collectUserBillGroups(clientDb, userId) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const endOfDueSoon = new Date(); endOfDueSoon.setDate(endOfDueSoon.getDate() + 3); endOfDueSoon.setHours(23, 59, 59, 999);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const billsSnap = await clientDb.collection('bills')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const groups = { overdue: [], dueToday: [], dueSoon: [], upcoming: [] };
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    if (due < thirtyDaysAgo) continue;

    const bill = { id: doc.id, ...data, dueDate: due.toISOString() };
    if (due < today) {
      bill.daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      groups.overdue.push(bill);
    } else if (due <= endOfToday) {
      groups.dueToday.push(bill);
    } else if (due <= endOfDueSoon) {
      groups.dueSoon.push(bill);
    } else if (due <= nextWeek) {
      groups.upcoming.push(bill);
    }
  }

  // Enrich credit card bills — same logic as before, add dueSoon to the loop
  try {
    const transactionsSnap = await clientDb.collection('transactions')
      .where('userId', '==', userId)
      .where('date', '>=', new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .get();
    const transactions = transactionsSnap.docs.map(d => d.data());

    const banksSnap = await clientDb.collection('userBanks')
      .where('userId', '==', userId)
      .get();
    const banks = banksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const list of [groups.overdue, groups.dueToday, groups.dueSoon, groups.upcoming]) {
      for (const bill of list) {
        if (bill.category !== 'credit_card' || !bill.linkedBankId) continue;
        const bank = banks.find(b => b.id === bill.linkedBankId);
        if (!bank || !bank.hasCredit) continue;

        const billDue = new Date(bill.dueDate);
        const closingDay = bank.closingDay || 10;
        const cycleEnd = new Date(billDue); cycleEnd.setDate(closingDay);
        if (cycleEnd > billDue) cycleEnd.setMonth(cycleEnd.getMonth() - 1);
        const cycleStart = new Date(cycleEnd);
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        cycleStart.setDate(cycleStart.getDate() + 1);

        const cycleTxs = transactions.filter(tx => {
          if (tx.bankId !== bill.linkedBankId || tx.type !== 'expense') return false;
          const txDate = new Date(tx.date);
          return txDate >= cycleStart && txDate <= cycleEnd;
        });
        bill.cardOutcomesAmount = cycleTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        bill.cardOutcomesCount = cycleTxs.length;
      }
    }
  } catch (err) {
    console.error(`[billReminders] Card enrichment error for user ${userId}:`, err);
  }

  return groups;
}
```

- [ ] **Step 2: Update `collectClientUserIds` to include dueSoon users**

Update the date boundary in `collectClientUserIds`:

```javascript
async function collectClientUserIds(clientDb) {
  const now = new Date();
  const endOfDueSoon = new Date(); endOfDueSoon.setDate(endOfDueSoon.getDate() + 3); endOfDueSoon.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const billsSnap = await clientDb.collection('bills')
    .where('status', '==', 'pending')
    .get();

  const userIds = new Set();
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.userId || !data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    // Include overdue, today, and 1-3 days ahead
    if (due < thirtyDaysAgo || due > endOfDueSoon) continue;
    userIds.add(data.userId);
  }
  return [...userIds];
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/billReminders.js
git commit -m "feat: expand bill reminders to include bills due 1-3 days ahead"
```

---

## Task 3: Update Bill Reminder Email Sender

**Files:**
- Modify: `functions/clientScheduledBillReminders.js`

- [ ] **Step 1: Update `sendBillReminderEmail` subject and send condition**

In `sendBillReminderEmail`, update the subject line to include dueSoon:

```javascript
async function sendBillReminderEmail(transporter, from, to, name, billGroups, billsUrl) {
  const allBills = [...billGroups.overdue, ...billGroups.dueToday, ...(billGroups.dueSoon || []), ...(billGroups.upcoming || [])];
  const grandTotal = allBills.reduce((sum, b) => sum + (b.cardOutcomesAmount != null ? b.cardOutcomesAmount : (b.amount || 0)), 0);

  let subject;
  if (billGroups.overdue.length > 0) {
    subject = `⚠️ ${billGroups.overdue.length} conta(s) atrasada(s) · ${formatCurrency(grandTotal)}`;
  } else if (billGroups.dueToday.length > 0) {
    subject = `📅 Vence hoje · ${formatCurrency(grandTotal)}`;
  } else {
    subject = `🔵 ${(billGroups.dueSoon || []).length} conta(s) nos próximos dias · ${formatCurrency(grandTotal)}`;
  }

  await transporter.sendMail({ from: `"Realwise" <${from}>`, to, subject, html: billReminderTemplate(name, billGroups, billsUrl) });
}
```

- [ ] **Step 2: Update send condition to include `dueSoon`**

Find the skip condition (around line 103):

```javascript
// OLD:
if (billGroups.overdue.length === 0 && billGroups.dueToday.length === 0) {
  console.log(`[clientBillReminders] Skipping ${userId} — no overdue/dueToday bills`);
  return;
}

// NEW:
const hasBillsToNotify = billGroups.overdue.length > 0 || billGroups.dueToday.length > 0 || (billGroups.dueSoon || []).length > 0;
if (!hasBillsToNotify) {
  console.log(`[clientBillReminders] Skipping ${userId} — no overdue/today/soon bills`);
  return;
}
```

- [ ] **Step 3: Update reminder_logs batch to also log dueSoon bills**

Find the batch loop (around line 112):

```javascript
// OLD:
for (const bill of [...billGroups.overdue, ...billGroups.dueToday].slice(0, 10)) {

// NEW:
for (const bill of [...billGroups.overdue, ...billGroups.dueToday, ...(billGroups.dueSoon || [])].slice(0, 10)) {
```

- [ ] **Step 4: Commit**

```bash
git add functions/clientScheduledBillReminders.js
git commit -m "feat: include dueSoon bills in reminder emails and subject line"
```

---

## Task 4: Create Abandoned Checkout Recovery Functions

**Files:**
- Create: `functions/abandonedCheckoutEmails.js`

- [ ] **Step 1: Create the file**

```javascript
'use strict';

const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const {
  checkoutReminderTemplate,
  checkoutCouponTemplate,
  checkoutLastChanceTemplate,
} = require('./emailTemplates');

const emailUser = defineSecret('EMAIL_USER');
const emailPassword = defineSecret('EMAIL_PASSWORD');
const emailHost = defineSecret('EMAIL_HOST');
const emailPort = defineSecret('EMAIL_PORT');

const db = admin.firestore();

const STAGES = { CREATED: 0, REMINDER_SENT: 1, COUPON_SENT: 2, LAST_CHANCE_SENT: 3 };
const DELAY_4H  = 4  * 60 * 60 * 1000;
const DELAY_24H = 24 * 60 * 60 * 1000;
const DELAY_48H = 48 * 60 * 60 * 1000;
const COUPON_TTL_MS = 24 * 60 * 60 * 1000;
const DISCOUNT_PERCENT = 10;
const CHECKOUT_URL = 'https://realwise.com.br/#pricing';

function emailToUsername(email) {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getTransporter() {
  try {
    const user = emailUser.value();
    const pass = emailPassword.value();
    const host = emailHost.value() || 'smtp.umbler.com';
    const port = Number(emailPort.value() || 587);
    if (!user || !pass) return null;
    return { transporter: nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } }), from: user };
  } catch (err) {
    console.error('[abandonedCheckout] Failed to load email secrets:', err);
    return null;
  }
}

async function upsertCoupon(email) {
  const code = emailToUsername(email);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + COUPON_TTL_MS);

  // Upsert: reuse existing abandoned_checkout coupon for same email if any
  const existing = await db.collection('coupons')
    .where('email', '==', email)
    .where('source', '==', 'abandoned_checkout')
    .limit(1)
    .get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ issuedAt, expiresAt, usedCount: 0 });
    return { code, expiresAt };
  }

  await db.collection('coupons').add({
    code,
    email,
    issuedAt,
    expiresAt,
    discountPercent: DISCOUNT_PERCENT,
    maxUses: 1,
    usedCount: 0,
    source: 'abandoned_checkout',
  });
  return { code, expiresAt };
}

async function sendStageEmail(transporter, from, session, stage) {
  const { email, name } = session;
  const displayName = name || email.split('@')[0];

  if (stage === STAGES.REMINDER_SENT) {
    await transporter.sendMail({
      from: `"Realwise" <${from}>`,
      to: email,
      subject: `${displayName}, você esqueceu algo 👀`,
      html: checkoutReminderTemplate(displayName, CHECKOUT_URL),
    });
    return { expiresAt: null };
  }

  if (stage === STAGES.COUPON_SENT || stage === STAGES.LAST_CHANCE_SENT) {
    const { code, expiresAt } = await upsertCoupon(email);
    const subject = stage === STAGES.COUPON_SENT
      ? `🎁 Seu cupom especial: ${code.toUpperCase()} — ${DISCOUNT_PERCENT}% off`
      : `⏰ Última chance: cupom ${code.toUpperCase()} expira hoje`;
    const html = stage === STAGES.COUPON_SENT
      ? checkoutCouponTemplate(displayName, code, DISCOUNT_PERCENT, expiresAt, CHECKOUT_URL)
      : checkoutLastChanceTemplate(displayName, code, expiresAt, CHECKOUT_URL);
    await transporter.sendMail({ from: `"Realwise" <${from}>`, to: email, subject, html });
    return { expiresAt };
  }
}

// Scheduled: every 6 hours, processes all pending checkout sessions
exports.abandonedCheckoutReminders = functions
  .runWith({ secrets: [emailUser, emailPassword, emailHost, emailPort] })
  .pubsub
  .schedule('0 0,6,12,18 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    console.log('[abandonedCheckout] Scheduled run starting...');
    const result = await getTransporter();
    if (!result) {
      console.log('[abandonedCheckout] Email secrets unavailable — aborting');
      return null;
    }
    const { transporter, from } = result;
    const now = Date.now();

    const snap = await db.collection('checkout_sessions')
      .where('stage', '<', STAGES.LAST_CHANCE_SENT)
      .get();

    let sent = 0;
    await Promise.all(snap.docs.map(async (doc) => {
      const session = { id: doc.id, ...doc.data() };
      const createdAt = session.createdAt?.toMillis ? session.createdAt.toMillis() : Date.now();
      const elapsed = now - createdAt;

      // Check lead is still not paid
      const leadSnap = await db.collection('leads').doc(session.email).get();
      if (leadSnap.exists) {
        const state = leadSnap.data().state;
        if (!['pending', 'not_paid'].includes(state)) {
          await doc.ref.delete();
          console.log(`[abandonedCheckout] Cleaned session for ${session.email} (state: ${state})`);
          return;
        }
      }

      let nextStage = null;
      if (session.stage === STAGES.CREATED && elapsed >= DELAY_4H) nextStage = STAGES.REMINDER_SENT;
      if (session.stage === STAGES.REMINDER_SENT && elapsed >= DELAY_24H) nextStage = STAGES.COUPON_SENT;
      if (session.stage === STAGES.COUPON_SENT && elapsed >= DELAY_48H) nextStage = STAGES.LAST_CHANCE_SENT;

      if (nextStage === null) return;

      try {
        await sendStageEmail(transporter, from, session, nextStage);
        await doc.ref.update({ stage: nextStage, lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
        sent++;
        console.log(`[abandonedCheckout] Sent stage ${nextStage} to ${session.email}`);
      } catch (err) {
        console.error(`[abandonedCheckout] Error sending to ${session.email}:`, err);
      }
    }));

    console.log(`[abandonedCheckout] Done. Sent ${sent} email(s).`);
    return null;
  });

// Callable: manual trigger from admin dashboard
exports.sendAbandonedCheckoutEmail = functions
  .runWith({ secrets: [emailUser, emailPassword, emailHost, emailPort] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

    const { email, stage } = data;
    if (!email || !Number.isInteger(stage) || stage < 1 || stage > 3) {
      throw new functions.https.HttpsError('invalid-argument', 'email and stage (1-3) are required');
    }

    const result = await getTransporter();
    if (!result) throw new functions.https.HttpsError('internal', 'Email not configured');
    const { transporter, from } = result;

    // Get or create checkout session doc
    const sessionRef = db.collection('checkout_sessions').doc(email);
    const sessionSnap = await sessionRef.get();
    const leadSnap = await db.collection('leads').doc(email).get();
    const name = leadSnap.exists ? (leadSnap.data().name || '') : '';

    if (!sessionSnap.exists) {
      await sessionRef.set({
        email,
        name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        stage: stage - 1,
        lastSentAt: null,
      });
    }

    const session = { email, name };
    await sendStageEmail(transporter, from, session, stage);
    await sessionRef.set({ stage, lastSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    return { success: true, email, stage };
  });
```

- [ ] **Step 2: Commit**

```bash
git add functions/abandonedCheckoutEmails.js
git commit -m "feat: add abandoned checkout recovery email sequence (4h/24h/48h)"
```

---

## Task 5: Update Stripe Webhook

**Files:**
- Modify: `functions/stripeWebhook.js`

- [ ] **Step 1: Handle `checkout.session.created` to track new sessions**

In `stripeWebhook.js`, update the event type guard (line 56) to handle both events:

```javascript
const { welcomeTemplate } = require('./emailTemplates');

// ... existing secret + stripe setup unchanged ...

exports.stripeWebhook = functions
  .runWith({ secrets: [stripeSecretKey, stripeWebhookSecret, emailUser, emailPassword] })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    const secretKey = stripeSecretKey.value();
    const webhookSecret = stripeWebhookSecret.value();
    if (!secretKey || !webhookSecret) { res.status(500).send('Configuration error'); return; }

    const stripe = Stripe(secretKey);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle checkout session created — track for abandoned checkout recovery
    if (event.type === 'checkout.session.created') {
      const session = event.data.object;
      const email = session.customer_email?.toLowerCase();
      const name = session.metadata?.name || '';
      if (email) {
        await db.collection('checkout_sessions').doc(email).set({
          email,
          name,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          stage: 0,
          lastSentAt: null,
          stripeSessionId: session.id,
        }, { merge: false });
        console.log(`[stripeWebhook] Checkout session created for ${email}`);
      }
      res.status(200).send('OK');
      return;
    }

    if (event.type !== 'checkout.session.completed') {
      res.status(200).send('OK');
      return;
    }

    // ... rest of completed handler unchanged ...
```

- [ ] **Step 2: On payment completion, delete checkout_sessions and send new welcome email**

At the end of the `checkout.session.completed` handler, after saving to Firestore and purchases, replace the `sendPurchaseEmail` call:

```javascript
    try {
      await db.collection('leads').doc(email).set(
        {
          paid: true,
          state: 'paid',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
          amountTotal,
        },
        { merge: true }
      );

      await db.collection('purchases').add({
        email, name, whatsapp, amountTotal,
        stripeSessionId: session.id,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Clean up abandoned checkout tracking
      await db.collection('checkout_sessions').doc(email).delete().catch(() => {});

      await sendPurchaseEmail({ name, email, whatsapp, amountTotal });

      res.status(200).send('OK');
    } catch (err) {
      console.error('Error handling checkout.session.completed:', err);
      res.status(500).send('Internal error');
    }
```

- [ ] **Step 3: Update `sendPurchaseEmail` to use new `welcomeTemplate`**

In `sendPurchaseEmail`, the welcome email is already using `welcomeTemplate(name || 'Cliente')`. Since we redesigned that template in Task 1, no code change is needed here — it will automatically pick up the new design.

Verify the import at the top of the file still reads:

```javascript
const { welcomeTemplate } = require('./emailTemplates');
```

If it does, no change needed.

- [ ] **Step 4: Note — enable `checkout.session.created` in Stripe Dashboard**

The Stripe webhook endpoint must be configured to also receive `checkout.session.created` events. In the Stripe dashboard:
1. Go to **Developers → Webhooks**
2. Select the endpoint for your webhook URL
3. Add the event: `checkout.session.created`

This is a Stripe dashboard change, not a code change.

- [ ] **Step 5: Commit**

```bash
git add functions/stripeWebhook.js
git commit -m "feat: track checkout.session.created and clean checkout_sessions on payment completion"
```

---

## Task 6: Export New Functions in `index.js`

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Import and re-export the new abandoned checkout functions**

At the bottom of `functions/index.js`, after all existing exports, add:

```javascript
const abandonedCheckout = require('./abandonedCheckoutEmails');
exports.abandonedCheckoutReminders = abandonedCheckout.abandonedCheckoutReminders;
exports.sendAbandonedCheckoutEmail = abandonedCheckout.sendAbandonedCheckoutEmail;
```

Also import the `updateLeadState` function if not already imported:

```javascript
const { updateLeadState } = require('./updateLeadState');
exports.updateLeadState = updateLeadState;
```

Check that `index.js` also exports `stripeWebhook`:

```javascript
const { stripeWebhook } = require('./stripeWebhook');
exports.stripeWebhook = stripeWebhook;
```

If these are already exported, skip.

- [ ] **Step 2: Verify import of `accessGrantedTemplate` uses the unified base**

In `index.js`, the `grantAccessAndNotify` function (for Mercado Pago payments) uses `accessGrantedTemplate`. This template already uses `getBaseTemplate()` so no change needed. Verify by checking the import line exists:

```javascript
const { welcomeTemplate, accessGrantedTemplate, billReminderTemplate } = require('./emailTemplates');
```

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: export abandonedCheckoutReminders and sendAbandonedCheckoutEmail functions"
```

---

## Task 7: Fix Lead Status and Add Recovery Email Buttons in Admin

**Files:**
- Modify: `src/pages/admin/LeadsDashboard.jsx`

- [ ] **Step 1: Fix the "unknown" status mapping**

In `LeadsDashboard.jsx`, the `onSnapshot` callback (around line 29) maps lead data. Add a `state` normalization. Find:

```javascript
return { id: d.id, ...data, state: data.state ?? (data.paid ? 'paid' : 'pending') };
```

Replace with:

```javascript
return {
  id: d.id,
  ...data,
  state: data.state || (data.paid ? 'paid' : 'pending'),
};
```

This ensures leads that have a falsy `state` (empty string or undefined) correctly fall back to `'pending'` instead of showing as blank/unknown in the dropdown.

- [ ] **Step 2: Add `sendingRecovery` state tracker**

At the top of the component, alongside existing state:

```javascript
const [sendingRecovery, setSendingRecovery] = useState({});
const [recoveryToast, setRecoveryToast] = useState(null);
```

- [ ] **Step 3: Add `handleSendRecovery` handler**

Inside the component, after `handleStateChange`:

```javascript
const handleSendRecovery = useCallback(async (email, stage) => {
  const key = `${email}-${stage}`;
  setSendingRecovery(prev => ({ ...prev, [key]: true }));
  try {
    await httpsCallable(functions, 'sendAbandonedCheckoutEmail')({ email, stage });
    setRecoveryToast(`Email sent to ${email}`);
    setTimeout(() => setRecoveryToast(null), 3000);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    setSendingRecovery(prev => ({ ...prev, [key]: false }));
  }
}, [functions]);
```

- [ ] **Step 4: Add recovery buttons in the lead row actions**

In the `<td>` that contains the action buttons (around line 155), add recovery buttons that show only for pending/not_paid leads:

```jsx
<td className="px-4 py-3">
  <div className="flex flex-wrap gap-2">
    <button
      onClick={() => setEmailTarget(lead)}
      className="px-3 py-1 bg-blue-800 hover:bg-blue-700 text-white text-xs rounded-lg"
    >
      Email
    </button>
    <button
      onClick={() => setDiscountTarget(lead)}
      className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded-lg"
    >
      Discount
    </button>
    {['pending', 'not_paid'].includes(lead.state) && (
      <div className="flex gap-1">
        {[
          { stage: 1, label: 'Reminder', color: 'bg-yellow-700 hover:bg-yellow-600' },
          { stage: 2, label: 'Coupon', color: 'bg-emerald-700 hover:bg-emerald-600' },
          { stage: 3, label: 'Last Chance', color: 'bg-red-700 hover:bg-red-600' },
        ].map(({ stage, label, color }) => (
          <button
            key={stage}
            disabled={sendingRecovery[`${lead.email}-${stage}`]}
            onClick={() => handleSendRecovery(lead.email, stage)}
            className={`px-2 py-1 ${color} disabled:opacity-40 text-white text-xs rounded-lg`}
          >
            {sendingRecovery[`${lead.email}-${stage}`] ? '…' : label}
          </button>
        ))}
      </div>
    )}
    <button
      disabled={lead.state !== 'paid'}
      onClick={() => startOnboarding(lead.email)}
      className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg"
    >
      Onboard
    </button>
  </div>
</td>
```

- [ ] **Step 5: Add toast notification above the table**

In the JSX, above the `{/* Table */}` comment:

```jsx
{recoveryToast && (
  <div className="fixed bottom-6 right-6 bg-emerald-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
    ✓ {recoveryToast}
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/LeadsDashboard.jsx
git commit -m "feat: fix unknown lead status and add recovery email buttons (reminder/coupon/last chance)"
```

---

## Task 8: Deploy

- [ ] **Step 1: Deploy cloud functions**

```bash
cd functions && npm install
firebase deploy --only functions
```

Expected: All 6+ functions deploy successfully. Check the Firebase Console for any errors.

- [ ] **Step 2: Enable `checkout.session.created` in Stripe Dashboard**

In Stripe Dashboard → Developers → Webhooks → your endpoint → add event `checkout.session.created`.

- [ ] **Step 3: Deploy hosting (for admin dashboard change)**

```bash
firebase deploy --only hosting
```

- [ ] **Step 4: Verify bill reminder with new dueSoon bills**

Check any user with a bill due 1-3 days from now. The daily reminder at 9 AM should now include them. You can trigger a manual test by temporarily changing the schedule or calling the function from Firebase Console.

- [ ] **Step 5: Verify abandoned checkout trigger**

1. Start a Stripe checkout session with a test email
2. Check Firestore `checkout_sessions` — a doc should appear with `stage: 0`
3. Use the admin dashboard Recovery buttons to manually send each stage
4. Verify each email arrives with the correct design

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: verify and deploy email system redesign"
```

---

## Self-Review

**Spec coverage:**

| Spec Requirement | Task |
|-----------------|------|
| Bill reminders 1-3 days ahead | Task 2, 3 |
| Abandoned checkout 4h/24h/48h | Task 4 |
| Coupon code = email username, 24h validity | Task 4 (upsertCoupon) |
| Manual trigger from admin | Task 4 (sendAbandonedCheckoutEmail), Task 7 |
| All templates use green/dark-mode design | Task 1 |
| Welcome email on purchase | Task 5 (welcomeTemplate redesign) |
| Lead status "unknown" fix | Task 7 |
| `checkout_sessions` collection | Task 4, 5 |
| MercadoPago welcome email | Uses `accessGrantedTemplate` which already uses `getBaseTemplate` — covered |
| Deploy notes | Task 8 |

**No placeholders found.**

**Type consistency:** `collectUserBillGroups` returns `{ overdue, dueToday, dueSoon, upcoming }` — used consistently in Tasks 2, 3, and the `billReminderTemplate` call in Task 1.
