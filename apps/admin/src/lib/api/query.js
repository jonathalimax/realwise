const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Builds a query string, dropping empty values. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    sp.set(key, String(value));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Absolute (or same-origin) URL for links such as CSV downloads. */
export function apiUrl(path, params) {
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}${path}${qs(params)}`;
}

/** Normalises list responses: `{ items, total, page, pageSize }` or a bare array. */
export function toPage(data, fallbackPageSize = 25) {
  if (Array.isArray(data)) return { items: data, total: data.length, page: 1, pageSize: fallbackPageSize };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total ?? data?.items?.length ?? 0),
    page: Number(data?.page ?? 1),
    pageSize: Number(data?.pageSize ?? fallbackPageSize),
  };
}
