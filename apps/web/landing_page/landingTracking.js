import { resolveApiBaseUrl } from '../src/lib/api/client';

/** First-party funnel numbers (visits, CTA taps, leads) for the admin. Independent of Google Analytics; never throws. */
const KEY = '__rw_visitor';

function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 64);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `anon-${Math.random().toString(16).slice(2, 12)}`;
  }
}

export const utmSource = () => new URLSearchParams(window.location.search).get('utm_source') || document.referrer.split('/')[2] || 'direct';

const url = (path) => `${resolveApiBaseUrl().replace(/\/$/, '')}/public/landing/${path}`;

export function trackLandingEvent(event, cta) {
  try {
    fetch(url('event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId(), event, cta, source: utmSource().slice(0, 80) }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* tracking must never break the page */
  }
}

/** Counts one visit per browser tab session. */
export function trackLandingView() {
  try {
    if (sessionStorage.getItem('__rw_view')) return;
    sessionStorage.setItem('__rw_view', '1');
  } catch {
    /* count it anyway */
  }
  trackLandingEvent('view');
}

export async function submitLead({ name, email, phone, consent, website }) {
  const res = await fetch(url('lead'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || undefined, email, phone: phone || undefined, consent, website, source: utmSource().slice(0, 80) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || 'Não consegui enviar agora. Tente de novo em instantes.');
  }
}
