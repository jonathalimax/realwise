# Cross-Project Bill Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `scheduledBillReminders` from querying only the shared project's Firestore to querying every client's isolated Firebase project using cross-project IAM — while updating the transfer script to grant deploy-only access (no Firestore) to the Realwise operator account.

**Architecture:** The shared function (`moneywise-ad9ec`) reads a `clients` collection in the shared Firestore as a registry of active client project IDs (no user data — just project IDs). For each client, it initializes a per-client Firebase Admin SDK app using cross-project IAM (no credential files — just IAM roles granted on each client project). Once a project is transferred to a client, it's no longer visible via gcloud from the operator's account — so the registry is the only reliable discovery mechanism.

**Tech Stack:** Firebase Admin SDK (multi-app), Cloud Functions v1, Firestore (shared registry + per-client data), gcloud CLI (IAM), Bash

**Active client projects:**
- `moneywise-jonathalimax` — Jonatha (operator's own)
- `moneywise-carloscalzadillar` — Carlos
- `moneywise-palomabandeiramatos5` — Paloma (already transferred, no longer visible via gcloud)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/transfer-client.sh` | Modify | Add IAM grants for operator deploy access + service account Firestore/Auth access |
| `functions/billReminders.js` | Create | Extracted per-user bill fetching, enrichment logic |
| `functions/index.js` | Modify | Refactor `scheduledBillReminders` to iterate clients registry + per-client SDK |

---

## Task 1: Update transfer-client.sh — IAM grants

**Files:**
- Modify: `scripts/transfer-client.sh`

Adds two IAM blocks **before** the `--remove-self` step:
1. Grant Realwise operator account deploy-only roles (Functions + Hosting, no Firestore)
2. Grant shared project service account Firestore + Auth access on the client project

- [ ] **Step 1: Add operator deploy-only roles block after line 74 (`echo "✓ Owner role granted."`)**

```bash
# Step 4 — Grant Realwise operator deploy-only access (no Firestore)
OPERATOR_EMAIL=$(gcloud config get-value account 2>/dev/null)
if [[ -n "$OPERATOR_EMAIL" && "$OPERATOR_EMAIL" != "(unset)" && "$REMOVE_SELF" != true ]]; then
  echo "→ Granting deploy-only roles to $OPERATOR_EMAIL on $PROJECT_ID..."
  for ROLE in \
    roles/cloudfunctions.developer \
    roles/firebasehosting.admin \
    roles/cloudbuild.builds.editor \
    roles/artifactregistry.writer \
    roles/iam.serviceAccountUser; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="user:$OPERATOR_EMAIL" \
      --role="$ROLE" \
      --quiet
  done
  echo "✓ Deploy-only roles granted (no Firestore access)."
fi
```

- [ ] **Step 2: Add service account Firestore + Auth access block immediately after**

```bash
# Step 5 — Grant shared project service account cross-project data access
echo "→ Granting moneywise service account Firestore + Auth access on $PROJECT_ID..."
for ROLE in \
  roles/datastore.user \
  roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$ADMIN_SA" \
    --role="$ROLE" \
    --quiet
done
echo "✓ Service account can now query $PROJECT_ID Firestore and Auth."
```

- [ ] **Step 3: Renumber existing `# Step 4 — Optionally remove self` → `# Step 6 — Optionally remove self`**

- [ ] **Step 4: Replace the final echo block with**

```bash
echo ""
echo "✓ Transfer complete for $PROJECT_ID → $CLIENT_EMAIL"
echo ""
echo "  Next: add an entry to the shared clients registry in Firestore:"
echo "  https://console.firebase.google.com/project/moneywise-ad9ec/firestore"
echo "  Collection: clients  |  Document ID: <clientId>"
echo "  Fields: projectId (string), clientId (string), active (boolean = true)"
echo ""
echo "  IAM Console: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
```

- [ ] **Step 5: Verify script parses cleanly**

```bash
bash -n scripts/transfer-client.sh
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add scripts/transfer-client.sh
git commit -m "feat(transfer): grant operator deploy-only + service account Firestore/Auth access"
```

---

## Task 2: Apply IAM grants to all existing clients

The transfer script handles future clients. For the 3 existing ones, apply grants manually.

Note: `moneywise-palomabandeiramatos5` is transferred — the operator no longer appears in `gcloud projects list` for it, but IAM grants can still be applied because `moneywise-ad9ec@appspot.gserviceaccount.com` already holds `projectIamAdmin` on it (granted by the existing transfer script).

- [ ] **Step 1: Apply grants to all three client projects**

```bash
ADMIN_SA="moneywise-ad9ec@appspot.gserviceaccount.com"

for PROJECT in moneywise-jonathalimax moneywise-carloscalzadillar moneywise-palomabandeiramatos5; do
  echo "→ Granting Firestore + Auth access on $PROJECT..."
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$ADMIN_SA" \
    --role="roles/datastore.user" \
    --quiet
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$ADMIN_SA" \
    --role="roles/firebaseauth.admin" \
    --quiet
  echo "✓ $PROJECT done."
done
```

- [ ] **Step 2: Verify bindings on each project**

```bash
for PROJECT in moneywise-jonathalimax moneywise-carloscalzadillar moneywise-palomabandeiramatos5; do
  echo "=== $PROJECT ==="
  gcloud projects get-iam-policy "$PROJECT" \
    --flatten="bindings[].members" \
    --filter="bindings.members:moneywise-ad9ec@appspot.gserviceaccount.com" \
    --format="table(bindings.role)"
done
```

Expected for each project:
```
ROLE
roles/datastore.user
roles/firebaseauth.admin
roles/resourcemanager.projectIamAdmin
```

---

## Task 3: Create `clients` registry in shared Firestore

The registry stores only project IDs — no user data. It's the discovery mechanism for transferred projects that are no longer visible via gcloud.

- [ ] **Step 1: Open shared Firestore**

Go to: `https://console.firebase.google.com/project/moneywise-ad9ec/firestore`

- [ ] **Step 2: Create collection `clients` with one document per client**

**Document 1** — ID: `jonathalimax`
```
projectId  (string)   →  "moneywise-jonathalimax"
clientId   (string)   →  "jonathalimax"
active     (boolean)  →  true
```

**Document 2** — ID: `carloscalzadillar`
```
projectId  (string)   →  "moneywise-carloscalzadillar"
clientId   (string)   →  "carloscalzadillar"
active     (boolean)  →  true
```

**Document 3** — ID: `palomabandeiramatos5`
```
projectId  (string)   →  "moneywise-palomabandeiramatos5"
clientId   (string)   →  "palomabandeiramatos5"
active     (boolean)  →  true
```

- [ ] **Step 3: Verify via gcloud**

```bash
gcloud firestore documents list \
  "projects/moneywise-ad9ec/databases/(default)/documents/clients" \
  --format="table(name)"
```
Expected: 3 document paths listed

---

## Task 4: Create `functions/billReminders.js`

**Files:**
- Create: `functions/billReminders.js`

Extracted per-user bill logic so `index.js` stays readable.

- [ ] **Step 1: Create the file**

```js
'use strict';

/**
 * Discovers userIds that have bills overdue or due today in a client Firestore.
 * Returns only users who need an email (overdue or due today).
 */
async function collectClientUserIds(clientDb) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const billsSnap = await clientDb.collection('bills')
    .where('status', '==', 'pending')
    .get();

  const userIds = new Set();
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.userId || !data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    if (due < thirtyDaysAgo || due > endOfToday) continue;
    userIds.add(data.userId);
  }
  return [...userIds];
}

/**
 * Fetches, categorizes, normalizes, and enriches pending bills for one user
 * from a given client Firestore instance.
 */
async function collectUserBillGroups(clientDb, userId) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const billsSnap = await clientDb.collection('bills')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const groups = { overdue: [], dueToday: [], upcoming: [] };
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
    } else if (due <= nextWeek) {
      groups.upcoming.push(bill);
    }
  }

  // Enrich credit card bills with actual transaction totals
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

    for (const list of [groups.overdue, groups.dueToday, groups.upcoming]) {
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
          if (tx.cardId !== bill.linkedBankId || tx.type !== 'expense') return false;
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

module.exports = { collectClientUserIds, collectUserBillGroups };
```

- [ ] **Step 2: Commit**

```bash
git add functions/billReminders.js
git commit -m "feat(functions): extract bill collection logic into billReminders.js"
```

---

## Task 5: Refactor `scheduledBillReminders` in `index.js`

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Add import for billReminders after existing requires (~line 16)**

```js
const { collectClientUserIds, collectUserBillGroups } = require('./billReminders');
```

- [ ] **Step 2: Replace the entire `exports.scheduledBillReminders` block with**

```js
exports.scheduledBillReminders = functions
  .runWith({ secrets: [emailUserSecret, emailPasswordSecret, emailHostSecret, emailPortSecret] })
  .pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    console.log('[scheduledBillReminders] Starting...');

    const transporter = getEmailTransporter();
    if (!transporter) {
      console.log('[scheduledBillReminders] Email secrets not set — aborting');
      return null;
    }
    const emailFrom = emailUserSecret.value();

    // Discover active clients from shared Firestore registry
    const clientsSnap = await db.collection('clients').where('active', '==', true).get();
    console.log(`[scheduledBillReminders] Found ${clientsSnap.size} active client(s)`);

    let totalSent = 0;

    for (const clientDoc of clientsSnap.docs) {
      const { projectId, clientId } = clientDoc.data();
      console.log(`[scheduledBillReminders] Processing client: ${clientId} (${projectId})`);

      try {
        const appName = `client-${clientId}`;
        const clientApp = admin.apps.find(a => a.name === appName)
          || admin.initializeApp({ projectId }, appName);
        const clientDb = admin.firestore(clientApp);
        const clientAuth = admin.auth(clientApp);

        const userIds = await collectClientUserIds(clientDb);
        console.log(`[scheduledBillReminders] ${clientId}: ${userIds.length} user(s) with actionable bills`);

        for (const userId of userIds) {
          try {
            const settingsDoc = await clientDb.collection('settings').doc(userId).get();
            if (settingsDoc.exists && settingsDoc.data().billReminders === false) continue;

            const authUser = await clientAuth.getUser(userId);
            if (!authUser.email) continue;

            const userName = settingsDoc.exists
              ? (settingsDoc.data().name || authUser.displayName)
              : authUser.displayName;

            const billGroups = await collectUserBillGroups(clientDb, userId);
            if (billGroups.overdue.length === 0 && billGroups.dueToday.length === 0) continue;

            const billsUrl = `https://realwise.com.br/${authUser.email.split('@')[0]}/bills`;
            await sendBillReminderEmail(
              transporter, emailFrom, authUser.email,
              userName || 'Cliente', billGroups, billsUrl
            );

            // Log to the client's own Firestore
            const batch = clientDb.batch();
            for (const bill of [...billGroups.overdue, ...billGroups.dueToday].slice(0, 10)) {
              batch.set(clientDb.collection('reminder_logs').doc(), {
                userId,
                billId: bill.id,
                billName: bill.name || bill.description || 'Conta',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                sentVia: 'email',
              });
            }
            await batch.commit();
            totalSent++;
          } catch (userErr) {
            console.error(`[scheduledBillReminders] Error for user ${userId} in ${clientId}:`, userErr);
          }
        }
      } catch (clientErr) {
        console.error(`[scheduledBillReminders] Error processing client ${clientId}:`, clientErr);
      }
    }

    console.log(`[scheduledBillReminders] Done. Sent ${totalSent} email(s).`);
    return null;
  });
```

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat(functions): refactor scheduledBillReminders for cross-project multi-client"
```

---

## Task 6: Deploy and verify

- [ ] **Step 1: Deploy to shared project**

```bash
firebase deploy --only functions:scheduledBillReminders --project moneywise-ad9ec
```

Expected: `✔ functions[scheduledBillReminders(us-central1)]: Successful update operation.`

- [ ] **Step 2: Force-run via Cloud Scheduler**

```bash
gcloud scheduler jobs run firebase-schedule-scheduledBillReminders-us-central1 \
  --project moneywise-ad9ec \
  --location us-central1
```

- [ ] **Step 3: Check logs**

```bash
firebase functions:log --only scheduledBillReminders --limit 50
```

Expected:
```
Found 3 active client(s)
Processing client: jonathalimax (moneywise-jonathalimax)
jonathalimax: N user(s) with actionable bills
Processing client: carloscalzadillar (moneywise-carloscalzadillar)
Processing client: palomabandeiramatos5 (moneywise-palomabandeiramatos5)
Done. Sent N email(s).
```

- [ ] **Step 4: Verify email received — Realwise template, `contato@realwise.com.br` sender**

---

## Future client onboarding (updated flow)

1. Run `./scripts/transfer-client.sh --project <projectId> --client-email <email> --billing-account <id>`
2. Add document to `clients` collection in `moneywise-ad9ec` Firestore
3. Next 9 AM cron picks them up automatically — **no redeploy needed**
