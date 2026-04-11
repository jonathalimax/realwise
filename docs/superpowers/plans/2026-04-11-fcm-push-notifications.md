# FCM Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WhatsApp bill reminder notifications with Firebase Cloud Messaging (FCM) push notifications, removing all WhatsApp notification infrastructure from the app.

**Architecture:** The frontend requests push permission on app load via a `usePushNotifications` hook in `Layout`, stores the FCM token in `settings/{userId}.fcmToken`, and a service worker handles background push display. The backend's `scheduledBillReminders` Cloud Function queries `fcmToken` from settings docs and sends push via Firebase Admin Messaging instead of WhatsApp.

**Tech Stack:** Firebase Messaging (client SDK), Firebase Admin SDK (server), Vite PWA service worker, Firestore

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/firebase.js` |
| Create | `public/firebase-messaging-sw.js` |
| Create | `src/hooks/usePushNotifications.js` |
| Modify | `src/components/Layout.jsx` |
| Modify | `src/pages/Notifications.jsx` |
| Modify | `src/components/SettingsModal.jsx` |
| Modify | `src/components/BillModal.jsx` |
| Modify | `src/locales/en.js` |
| Modify | `src/locales/pt.js` |
| Modify | `functions/index.js` |
| Delete | `functions/whatsapp-service.js` |
| Delete | `functions/phoneUtils.js` |
| Add env | `.env` (VITE_FIREBASE_VAPID_KEY) |

---

## Pre-requisites

Before starting, get your VAPID key:
1. Go to [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → Cloud Messaging
2. Under **Web Push certificates**, click **Generate key pair** if none exists
3. Copy the **Key pair** value — this is your VAPID key

---

### Task 1: Add Firebase Messaging to firebase.js

**Files:**
- Modify: `src/firebase.js`

- [ ] **Step 1: Add app export to firebase.js**

Add a single line to export `app` after `const app = initializeApp(firebaseConfig);` (around line 35):

```js
// BEFORE (line 35):
const app = initializeApp(firebaseConfig);

// AFTER:
const app = initializeApp(firebaseConfig);
export { app };
```

No other changes needed to `firebase.js`. The hook will call `isSupported()` and `getMessaging(app)` itself — this avoids top-level `await` in the module which would break Vite's module graph.

- [ ] **Step 2: Add VAPID key to .env**

Open `.env` (and `.env.production` if it exists) and add:

```
VITE_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE
```

- [ ] **Step 3: Commit**

```bash
git add src/firebase.js .env
git commit -m "feat: add Firebase Messaging to firebase.js"
```

---

### Task 2: Create the FCM service worker

**Files:**
- Create: `public/firebase-messaging-sw.js`

FCM requires a service worker at this exact path to handle background push notifications.

- [ ] **Step 1: Create the service worker**

```js
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// This config is duplicated here because service workers can't import ES modules.
// Keep messagingSenderId and appId in sync with your .env values.
firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG_API_KEY,
  authDomain: self.__FIREBASE_CONFIG_AUTH_DOMAIN,
  projectId: self.__FIREBASE_CONFIG_PROJECT_ID,
  storageBucket: self.__FIREBASE_CONFIG_STORAGE_BUCKET,
  messagingSenderId: self.__FIREBASE_CONFIG_MESSAGING_SENDER_ID,
  appId: self.__FIREBASE_CONFIG_APP_ID,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
  });
});
```

> **Note:** The `self.__FIREBASE_CONFIG_*` values will be injected at runtime by the `usePushNotifications` hook via `postMessage`. See Task 3 for details.

- [ ] **Step 2: Commit**

```bash
git add public/firebase-messaging-sw.js
git commit -m "feat: add FCM background service worker"
```

---

### Task 3: Create usePushNotifications hook

**Files:**
- Create: `src/hooks/usePushNotifications.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/usePushNotifications.js
import { useEffect } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db, auth } from '../firebase';

export function usePushNotifications() {
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    let unsubscribe = null;

    async function registerPush() {
      try {
        const supported = await isSupported();
        if (!supported) return;

        const messaging = getMessaging(app);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Inject firebase config into the service worker so it can initialize
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: 'FIREBASE_CONFIG',
          config: {
            __FIREBASE_CONFIG_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
            __FIREBASE_CONFIG_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            __FIREBASE_CONFIG_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            __FIREBASE_CONFIG_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            __FIREBASE_CONFIG_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            __FIREBASE_CONFIG_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
          },
        });

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          await setDoc(
            doc(db, 'settings', userId),
            { fcmToken: token },
            { merge: true }
          );
        }

        // Handle foreground messages (app is open)
        unsubscribe = onMessage(messaging, (payload) => {
          const { title, body } = payload.notification;
          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/pwa-192x192.png' });
          }
        });
      } catch (err) {
        console.error('[usePushNotifications] Registration failed:', err);
      }
    }

    registerPush();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
}
```

- [ ] **Step 2: Update the service worker to receive the config**

The service worker needs to handle the `postMessage` to set config values. Update `public/firebase-messaging-sw.js`:

```js
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    const cfg = event.data.config;
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: cfg.__FIREBASE_CONFIG_API_KEY,
        authDomain: cfg.__FIREBASE_CONFIG_AUTH_DOMAIN,
        projectId: cfg.__FIREBASE_CONFIG_PROJECT_ID,
        storageBucket: cfg.__FIREBASE_CONFIG_STORAGE_BUCKET,
        messagingSenderId: cfg.__FIREBASE_CONFIG_MESSAGING_SENDER_ID,
        appId: cfg.__FIREBASE_CONFIG_APP_ID,
      });
      messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const { title, body } = payload.notification;
        self.registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
        });
      });
    }
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePushNotifications.js public/firebase-messaging-sw.js
git commit -m "feat: add usePushNotifications hook and update service worker"
```

---

### Task 4: Wire hook into Layout

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Add hook call to Layout**

```jsx
// src/components/Layout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function Layout() {
  usePushNotifications();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "feat: request push notification permission on app load"
```

---

### Task 5: Rewrite Notifications.jsx

Remove all WhatsApp configuration UI. Keep the pending bills list — it remains useful to show which bills will trigger reminders. Replace the config card with a push notification status card.

**Files:**
- Modify: `src/pages/Notifications.jsx`

- [ ] **Step 1: Rewrite the file**

```jsx
import { useMemo } from 'react';
import {
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';

export default function NotificationsPage() {
  const { language } = useSettings();
  const { bills } = useBills();

  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

  const billsWithReminders = useMemo(
    () => bills.filter((bill) => bill.status === 'pending' && bill.dueDate),
    [bills]
  );

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Notificações' : 'Notifications'}
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Push notification status card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${permission === 'granted' ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                {permission === 'granted'
                  ? <BellIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  : <BellSlashIcon className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {language === 'pt' ? 'Notificações Push' : 'Push Notifications'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {permission === 'granted'
                    ? (language === 'pt' ? 'Notificações ativas' : 'Notifications enabled')
                    : permission === 'denied'
                      ? (language === 'pt' ? 'Permissão negada pelo navegador' : 'Permission denied by browser')
                      : (language === 'pt' ? 'Permissão não concedida ainda' : 'Permission not granted yet')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <BellIcon className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                {language === 'pt' ? 'Como funciona?' : 'How does it work?'}
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-300 mt-1">
                {language === 'pt'
                  ? 'Todos os dias às 9h (horário de Brasília), você receberá uma notificação push sobre as contas próximas do vencimento ou atrasadas.'
                  : 'Every day at 9 AM (Brazil time), you will receive a push notification about bills that are due soon or overdue.'}
              </p>
            </div>
          </div>
        </div>

        {/* Pending bills list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Contas pendentes' : 'Pending bills'}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({billsWithReminders.length})
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {language === 'pt' ? 'Estas contas serão incluídas nos lembretes' : 'These bills will be included in reminders'}
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {billsWithReminders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-gray-900 dark:text-white">
                  {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'pt' ? 'Todas as suas contas estão em dia!' : 'All your bills are up to date!'}
                </p>
              </div>
            ) : (
              billsWithReminders.slice(0, 10).map((bill) => {
                const dueDate = new Date(bill.dueDate);
                const today = new Date();
                const isOverdue = dueDate < today;
                const isDueSoon = !isOverdue && (dueDate - today) / (1000 * 60 * 60 * 24) <= 3;

                return (
                  <div key={bill.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{bill.name}</p>
                      <p className={`text-xs ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : isDueSoon
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {isOverdue
                          ? (language === 'pt' ? 'Atrasada - ' : 'Overdue - ')
                          : isDueSoon
                            ? (language === 'pt' ? 'Vence em breve - ' : 'Due soon - ')
                            : ''}
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      isOverdue ? 'bg-red-500' : isDueSoon ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  </div>
                );
              })
            )}
            {billsWithReminders.length > 10 && (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {language === 'pt'
                  ? `+${billsWithReminders.length - 10} outras contas`
                  : `+${billsWithReminders.length - 10} more bills`}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Notifications.jsx
git commit -m "feat: replace WhatsApp config UI with push notification status in Notifications page"
```

---

### Task 6: Remove WhatsApp from SettingsModal.jsx

**Files:**
- Modify: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Remove WhatsApp state declarations**

Find and delete these three state lines (around line 37–41):

```js
// DELETE these lines:
const [whatsappNumber, setWhatsappNumber] = useState('');
const [whatsappError, setWhatsappError] = useState('');
const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
const [savingWhatsapp, setSavingWhatsapp] = useState(false);
```

- [ ] **Step 2: Remove the WhatsApp useEffect**

Find and delete (around line 50–55):

```js
// DELETE these lines:
// Load WhatsApp number when General tab is opened
useEffect(() => {
  if (activeTab === 'general' && isOpen) {
    loadWhatsappNumber();
  }
}, [activeTab, isOpen]);
```

- [ ] **Step 3: Remove loadWhatsappNumber and handleSaveWhatsappNumber functions**

Find and delete the `loadWhatsappNumber` function (starts around line 143) and the `handleSaveWhatsappNumber` function. They will be near each other in the "WhatsApp functions" comment block.

- [ ] **Step 4: Remove WhatsApp section from General tab**

In the General tab JSX (around line 407), find and delete the entire WhatsApp block:

```jsx
{/* DELETE this entire block: */}
{/* WhatsApp */}
<div>
  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
    {language === 'pt' ? 'Notificações WhatsApp' : 'WhatsApp Notifications'}
  </h3>
  {loadingWhatsapp ? ( ... ) : ( ... )}
</div>
```

- [ ] **Step 5: Remove the WhatsApp tab button**

Find the tab buttons section (around line 309). Delete the WhatsApp tab button — it will look like:

```jsx
{/* DELETE this button: */}
<button
  onClick={() => setActiveTab('whatsapp')}
  className={`...`}
>
  {language === 'pt' ? 'WhatsApp' : 'WhatsApp'}
</button>
```

- [ ] **Step 6: Remove the WhatsApp tab panel**

Find `{activeTab === 'whatsapp' && (` (around line 837) and delete the entire block until its closing `)}`.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsModal.jsx
git commit -m "feat: remove WhatsApp notification settings from SettingsModal"
```

---

### Task 7: Fix BillModal.jsx label

**Files:**
- Modify: `src/components/BillModal.jsx`

- [ ] **Step 1: Change label text**

Find (around line 274):

```jsx
{language === 'pt' ? 'Notificações WhatsApp' : 'WhatsApp Notifications'}
```

Replace with:

```jsx
{language === 'pt' ? 'Notificações' : 'Notifications'}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BillModal.jsx
git commit -m "fix: rename WhatsApp Notifications label to Notifications in BillModal"
```

---

### Task 8: Remove WhatsApp locale strings

**Files:**
- Modify: `src/locales/en.js`
- Modify: `src/locales/pt.js`

- [ ] **Step 1: Remove from en.js**

Find and delete (around line 153):

```js
whatsappNotification: 'WhatsApp notification sent',
```

- [ ] **Step 2: Remove from pt.js**

Find and delete (around line 153):

```js
whatsappNotification: 'Notificação WhatsApp enviada',
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/en.js src/locales/pt.js
git commit -m "fix: remove WhatsApp locale strings"
```

---

### Task 9: Update scheduledBillReminders in functions/index.js

Replace the WhatsApp-based scheduled reminder with FCM.

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Remove whatsapp-service and phoneUtils requires**

At the top of `functions/index.js`, find and delete lines 11–12:

```js
// DELETE these lines:
const whatsappService = require('./whatsapp-service');
const { normalizeBrazilE164FixNine, assertBrazilE164 } = require('./phoneUtils');
```

- [ ] **Step 2: Remove whatsappWebhook export**

Find `exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {` (around line 493) and delete the entire export function until its closing `});`.

- [ ] **Step 3: Remove handleTextMessage and handleInteractiveReply functions**

Find and delete the `async function handleTextMessage(` and `async function handleInteractiveReply(` internal functions (they follow `whatsappWebhook`).

- [ ] **Step 4: Replace scheduledBillReminders**

Find `exports.scheduledBillReminders = functions.pubsub` (around line 763) and replace the entire export (through its closing `});`) with:

```js
/**
 * Scheduled function to send FCM push bill reminders
 * Runs daily at 9 AM Brazil time
 */
exports.scheduledBillReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    try {
      console.log('Starting scheduled FCM bill reminders...');

      // Get all settings docs that have an FCM token
      const settingsSnap = await db.collection('settings').where('fcmToken', '!=', null).get();
      console.log(`Found ${settingsSnap.size} user(s) with FCM token`);

      let totalRemindersSent = 0;

      for (const settingsDoc of settingsSnap.docs) {
        const userId = settingsDoc.id;
        const { fcmToken } = settingsDoc.data();
        try {
          const sent = await sendFcmRemindersForUser(userId, fcmToken);
          totalRemindersSent += sent;
        } catch (err) {
          console.error(`Error sending FCM reminders to user ${userId}:`, err);
        }
      }

      console.log(`Scheduled FCM reminders done. Sent ${totalRemindersSent} notification(s).`);
      return null;
    } catch (err) {
      console.error('Error in scheduledBillReminders:', err);
      return null;
    }
  });

/**
 * Send FCM push reminders for a specific user
 * @returns {number} number of notifications sent
 */
async function sendFcmRemindersForUser(userId, fcmToken) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const billsSnap = await db.collection('bills')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const dueBills = billsSnap.docs
    .filter((d) => {
      const { dueDate } = d.data();
      if (!dueDate) return false;
      const due = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
      return due <= endOfToday;
    })
    .slice(0, 5);

  if (dueBills.length === 0) return 0;

  let sent = 0;

  for (const billDoc of dueBills) {
    const { name, description, amount } = billDoc.data();
    const billName = name || description || 'Conta';
    const amountStr = amount != null ? ` - R$ ${Number(amount).toFixed(2)}` : '';

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: 'Limas Finance',
          body: `${billName}${amountStr} vence hoje ou está atrasada`,
        },
      });

      await db.collection('reminder_logs').add({
        userId,
        billId: billDoc.id,
        billName,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentVia: 'fcm',
      });

      sent++;
    } catch (err) {
      console.error('Error sending FCM for bill:', billDoc.id, err);
    }
  }

  return sent;
}
```

- [ ] **Step 5: Remove sendWhatsAppReminder export**

Find `exports.sendWhatsAppReminder = functions.https.onRequest(` (around line 873) and delete the entire export through its closing `});`.

- [ ] **Step 6: Remove testWhatsApp export**

Find `exports.testWhatsApp = functions.https.onRequest(` (around line 920) and delete the entire export through its closing `});`.

- [ ] **Step 7: Verify the file compiles**

```bash
cd functions && node -e "require('./index.js')" 2>&1 | head -20
```

Expected: no errors (some "not configured" warnings for Mercado Pago / email are fine).

- [ ] **Step 8: Commit**

```bash
git add functions/index.js
git commit -m "feat: replace WhatsApp bill reminders with FCM push notifications in Cloud Functions"
```

---

### Task 10: Delete whatsapp-service.js and phoneUtils.js

**Files:**
- Delete: `functions/whatsapp-service.js`
- Delete: `functions/phoneUtils.js`

- [ ] **Step 1: Delete the files**

```bash
rm functions/whatsapp-service.js functions/phoneUtils.js
```

- [ ] **Step 2: Commit**

```bash
git add -A functions/whatsapp-service.js functions/phoneUtils.js
git commit -m "chore: remove WhatsApp service and phone utils files"
```

---

### Task 11: Deploy Cloud Functions

- [ ] **Step 1: Deploy**

```bash
firebase deploy --only functions
```

Expected: deployment succeeds. The `whatsappWebhook`, `sendWhatsAppReminder`, and `testWhatsApp` functions will be deleted from Firebase automatically since they are no longer exported.

- [ ] **Step 2: Clean up Firebase config (optional)**

```bash
firebase functions:config:unset whatsapp
```

---

### Task 12: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and verify**

1. Log in — the browser should show a push notification permission prompt
2. Navigate to `/notifications` — should show push status card (granted/denied) and pending bills list
3. Open Settings — no WhatsApp tab, no WhatsApp section in General tab
4. Open a bill — label shows "Notifications" not "WhatsApp Notifications"

- [ ] **Step 3: Commit any fixes found during smoke test**
