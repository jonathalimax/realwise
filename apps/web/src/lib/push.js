import { pushResource } from './api/resources/push';

export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const urlBase64ToUint8Array = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const b64 = (buffer) => window.btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * What the Notifications screen should offer:
 * - 'install'     iPhone/iPad in a normal tab: push only works once the app is on the Home Screen
 * - 'unsupported' this browser has no push at all
 * - 'denied'      the person said no in the browser: only the system settings can undo it
 * - 'off'         can be turned on with a tap
 * - 'on'          this device is subscribed
 */
export async function getPushState() {
  if (isIOS() && !isStandalone()) return 'install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (await reg.pushManager.getSubscription()) return 'on';
    } catch { /* fall through to "off" */ }
  }
  return 'off';
}

/** Must run from a tap: Safari ignores permission prompts that are not a response to a gesture. */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await pushResource.config();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await pushResource.subscribe({ endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')) });
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await pushResource.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}
