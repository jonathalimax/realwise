# FCM Push Notifications — Replace WhatsApp Bill Reminders

**Date:** 2026-04-11
**Status:** Approved

## Overview

Replace the WhatsApp Cloud API bill reminder system with Firebase Cloud Messaging (FCM) push notifications. The `WhatsAppButton` component used for customer support contact is kept unchanged. All other WhatsApp references are removed.

## Architecture

### Data Flow

**Token registration (frontend):**
```
App loads (Home.jsx, authenticated)
  → usePushNotifications hook runs
  → Notification.requestPermission() called automatically
  → getToken(messaging, { vapidKey }) retrieves FCM token
  → token saved to Firestore: settings/{userId}.fcmToken
```

**Daily reminders (backend):**
```
scheduledBillReminders (daily 9 AM Brazil time)
  → query all settings docs with fcmToken field
  → for each user: fetch pending/overdue bills
  → send FCM push via admin.messaging().send()
  → user receives native push notification
```

## Frontend Changes

### New: `src/hooks/usePushNotifications.js`
- Requests notification permission on first call
- Gets FCM token via `getToken(messaging, { vapidKey })`
- Saves token to `settings/{userId}.fcmToken` in Firestore
- Called once from `Home.jsx` after auth is confirmed
- Handles token refresh via `onTokenRefresh`

### Modified: `src/firebase.js`
- Initialize Firebase Messaging
- Export `messaging` instance

### Modified: `src/pages/Home.jsx`
- Import and call `usePushNotifications` hook after auth is confirmed

### Modified: `src/components/SettingsModal.jsx`
- Remove WhatsApp section from General tab
- Remove WhatsApp tab entirely
- Remove `whatsappNumber`, `whatsappError` state and all related functions

### Modified: `src/pages/Notifications.jsx`
- Remove WhatsApp number configuration UI and state
- Simplify or remove page if no other content remains

### Modified: `src/components/BillModal.jsx`
- Remove "WhatsApp Notifications" reference

### Modified: `src/locales/en.js` and `src/locales/pt.js`
- Remove `whatsappNotification` key and any other WhatsApp-specific strings

## Backend Changes

### Deleted files
- `functions/whatsapp-service.js` — entire file removed
- `functions/phoneUtils.js` — entire file removed (only used by WhatsApp service)

### Modified: `functions/index.js`

**Removed exports:**
- `whatsappWebhook`
- `sendWhatsAppReminder`
- `testWhatsApp`

**Removed internal functions:**
- `handleTextMessage`
- `handleInteractiveReply`
- `require('./whatsapp-service')`

**Updated `scheduledBillReminders`:**
- Query `settings` collection for docs with `fcmToken` field (instead of `whatsappNumber`)
- For each user with pending/overdue bills, send via `admin.messaging().send()`

**FCM message payload:**
```js
{
  token: fcmToken,
  notification: {
    title: 'Limas Finance',
    body: 'Conta "Netflix" vence amanhã - R$ 55,90'
  }
}
```

### Firebase config cleanup (after deploy)
Remove from Firebase config:
- `whatsapp.access_token`
- `whatsapp.phone_number_id`
- `whatsapp.verify_token`

## Firestore

### Settings document changes
- Remove field: `whatsappNumber`
- Remove field: `whatsappNumbers`
- Remove field: `whatsappNotificationsEnabled`
- Add field: `fcmToken` (string, written by frontend on permission grant)

Existing documents with old WhatsApp fields can be left as-is — they are simply ignored going forward.

## What Is Not Changed

- `src/components/WhatsAppButton.jsx` — customer support contact button, untouched
- All pages that reference `WhatsAppButton` as a support contact
- All other Firebase Functions unrelated to WhatsApp

## Success Criteria

- Users receive a native push notification for pending/overdue bills daily at 9 AM Brazil time
- No WhatsApp configuration UI exists in the app
- No WhatsApp functions are deployed
- `WhatsAppButton` for support contact continues to work
