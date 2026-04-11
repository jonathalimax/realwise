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
