// An email button can open the app while the user is signed out. Login always lands on the dashboard, so the
// intended chat link is remembered here (for 30 minutes) and replayed once after sign-in.
const KEY = 'rw:after-login';
const MAX_AGE_MS = 30 * 60 * 1000;

/** `pathname` includes the client prefix (`/acme/chat`); only chat deep links (?intent / ?suggestion) are kept. */
export function rememberDeepLink(pathname, search) {
  try {
    const params = new URLSearchParams(search);
    if (!params.has('intent') && !params.has('suggestion')) return;
    const withoutClient = pathname.replace(/^\/[^/]+/, '') || '/';
    localStorage.setItem(KEY, JSON.stringify({ to: `${withoutClient}${search}`, at: Date.now() }));
  } catch {
    /* storage unavailable: the user just lands on the dashboard */
  }
}

/** The remembered in-app path without clearing it (safe to call during render). */
export function peekDeepLink() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { to, at } = JSON.parse(raw);
    return typeof to === 'string' && Date.now() - at < MAX_AGE_MS ? to : null;
  } catch {
    return null;
  }
}

/** The remembered in-app path (relative to the client router), once. */
export function consumeDeepLink() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { to, at } = JSON.parse(raw);
    return typeof to === 'string' && Date.now() - at < MAX_AGE_MS ? to : null;
  } catch {
    return null;
  }
}
