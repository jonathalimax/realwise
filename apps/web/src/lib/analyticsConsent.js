const STORAGE_KEY = 'rw_analytics_consent';
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-4S1ME4WCMY';

let loaded = false;

/** 'granted' | 'denied' | null (not answered yet). Storage can be blocked, so every access is guarded. */
export function getAnalyticsConsent() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Loads Google Analytics. Nothing from Google is requested before this runs, so it only runs after "Aceitar". */
function loadGoogleAnalytics() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.onload = async () => {
    if (window.location.pathname === '/') {
      // The landing page also reports scroll depth and section views.
      const { landingAnalytics } = await import('../../landing_page/landingAnalytics');
      landingAnalytics.init(GA_ID);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID);
    }
  };
  document.head.appendChild(script);
}

/** Call once at startup: honours a previous "Aceitar" and does nothing otherwise. */
export function initAnalytics() {
  if (getAnalyticsConsent() === 'granted') loadGoogleAnalytics();
}

export function setAnalyticsConsent(value) {
  const previous = getAnalyticsConsent();
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable: the choice just lasts until the page is closed */
  }
  if (value === 'granted') loadGoogleAnalytics();
  // A script that is already running cannot be unloaded, so withdrawing consent restarts the page without it.
  if (value !== 'granted' && previous === 'granted') window.location.reload();
}
