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
