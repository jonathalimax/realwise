import { normalizePath, reportError } from '../errorReporter';

const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api.realwise.com.br';

export function resolveApiBaseUrl(envBaseUrl = import.meta.env.VITE_API_BASE_URL) {
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const hostname = window.location?.hostname ?? '';
  if (hostname === 'realwise.com.br' || hostname.endsWith('.realwise.com.br')) {
    return DEFAULT_PRODUCTION_API_BASE_URL;
  }

  return '';
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) return path;
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function readResponseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

export const SUBSCRIPTION_REQUIRED_EVENT = 'rw:subscription-required';
/** The refresh token was rejected too: the person really is signed out. */
export const SESSION_EXPIRED_EVENT = 'rw:session-expired';

// The access cookie is short-lived. A phone that slept for a while comes back with an expired one, so the first 401
// refreshes the session once (shared by every request that fails at the same time) and replays the request.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/logout'];
let refreshInFlight = null;
function refreshSessionOnce(baseUrl) {
  refreshInFlight ??= fetch(joinUrl(baseUrl, '/auth/refresh'), { method: 'POST', credentials: 'include' })
    .then((r) => (r.ok ? 'ok' : r.status === 401 || r.status === 403 ? 'denied' : 'error'))
    .catch(() => 'error')
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function createApiClient({ baseUrl, defaultHeaders = {} } = {}) {
  const resolvedBaseUrl = baseUrl ?? resolveApiBaseUrl();

  async function request(path, { method = 'GET', headers = {}, body } = {}, retried = false) {
    const finalHeaders = { ...defaultHeaders, ...headers };
    const init = {
      method,
      credentials: 'include',
      headers: finalHeaders,
    };

    if (body !== undefined) {
      if (body instanceof FormData) {
        init.body = body;
      } else {
        init.body = JSON.stringify(body);
        init.headers = {
          'Content-Type': 'application/json',
          ...finalHeaders,
        };
      }
    }

    let response;
    try {
      response = await fetch(joinUrl(resolvedBaseUrl, path), init);
    } catch (error) {
      // The request never reached the server (so the API could not log it). Being offline is not our bug.
      if (error?.name !== 'AbortError' && typeof navigator !== 'undefined' && navigator.onLine !== false) {
        reportError(error, { kind: 'network', request: `${method} ${normalizePath(path)}` });
      }
      throw error;
    }
    const data = await readResponseBody(response);

    if (response.status === 401 && !retried && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
      const outcome = await refreshSessionOnce(resolvedBaseUrl);
      if (outcome === 'ok') return request(path, { method, headers, body }, true);
      if (outcome === 'denied' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    if (!response.ok) {
      // The server blocks every non-billing route once the trial/subscription is over.
      // Tell the auth layer so it re-reads /auth/me and the gate flips to the paywall.
      if (response.status === 402 && data?.code === 'SUBSCRIPTION_REQUIRED' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SUBSCRIPTION_REQUIRED_EVENT));
      }

      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;
      throw new ApiError(message, { status: response.status, data });
    }

    return data;
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}

export const apiClient = createApiClient();
