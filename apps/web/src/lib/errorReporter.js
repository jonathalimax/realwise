import { resolveApiBaseUrl } from './api/client';

const MAX_PER_PAGE_LOAD = 15;
const DEDUPE_MS = 60_000;
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i];
const FOREIGN_CODE = /(chrome|moz|safari|webkit-masked-url)-?extension:/i;

const seen = new Map();
let sent = 0;

/** `/bills/3f2a…` -> `/bills/:id`, so ids and query strings never leave the browser. */
export const normalizePath = (value) =>
  String(value ?? '')
    .split(/[?#]/)[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 300);

/**
 * Tells the API that something broke in the browser (metadata only: message, stack, page, kind). Never throws and never
 * waits: reporting an error must not become another one. The server attaches the user from the session cookie.
 */
export function reportError(error, { kind = 'js', request = null, status = null, componentStack = null } = {}) {
  try {
    if (typeof window === 'undefined' || sent >= MAX_PER_PAGE_LOAD) return;
    const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 2000);
    const stack = typeof error?.stack === 'string' ? error.stack : '';
    if (NOISE.some((re) => re.test(message)) || FOREIGN_CODE.test(stack)) return;

    const key = `${kind}|${message}`;
    const now = Date.now();
    if (now - (seen.get(key) ?? 0) < DEDUPE_MS) return;
    seen.set(key, now);
    sent += 1;

    void fetch(`${resolveApiBaseUrl()}/public/errors`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack: stack.slice(0, 8000),
        kind,
        page: normalizePath(window.location.pathname),
        request,
        status,
        componentStack: componentStack ? String(componentStack).slice(0, 2000) : null,
        release: import.meta.env.VITE_COMMIT_SHA ?? null,
      }),
    }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
}

/** Catches what React does not: uncaught errors and promise rejections nobody handled. */
export function installErrorReporter() {
  if (typeof window === 'undefined' || window.__rwErrorReporter) return;
  window.__rwErrorReporter = true;
  window.addEventListener('error', (event) => {
    // Resource load failures (img/script) fire here without a message; they are not app errors.
    if (!event.error && !event.message) return;
    reportError(event.error ?? event.message, { kind: 'js' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError') return;
    // API errors with a status are already stored by the server; only report what never reached it.
    if (reason?.name === 'ApiError') return;
    reportError(reason instanceof Error ? reason : new Error(String(reason)), { kind: 'rejection' });
  });
}
