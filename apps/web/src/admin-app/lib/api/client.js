// Same resolution as the customer app (build variable, else the production API on realwise.com.br hosts).
import { resolveApiBaseUrl } from '../../../lib/api/client';

const DEFAULT_BASE_URL = resolveApiBaseUrl();

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

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function createApiClient({ baseUrl = DEFAULT_BASE_URL, defaultHeaders = {} } = {}) {
  async function request(path, { method = 'GET', headers = {}, body } = {}) {
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

    const response = await fetch(joinUrl(baseUrl, path), init);
    const data = await readResponseBody(response);

    if (!response.ok) {
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
