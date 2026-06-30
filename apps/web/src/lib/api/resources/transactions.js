import { apiClient } from '../client';

const TRANSACTIONS_CHANGED_EVENT = 'rw:transactions:changed';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeTransaction(data) {
  return {
    ...data,
    amount: toNumber(data?.amount),
    category: data?.category ?? 'Sem categoria',
  };
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function notifyTransactionsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT));
}

export function subscribeTransactionsChanged(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(TRANSACTIONS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, listener);
}

export function createTransactionsResource({ client = apiClient } = {}) {
  return {
    async list(params = {}) {
      if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
        const rows = await client.get(`/transactions${buildQuery(params)}`);
        return Array.isArray(rows) ? rows.map(normalizeTransaction) : [];
      }

      const pageSize = 200;
      const results = [];
      let offset = 0;

      while (true) {
        const rows = await client.get(`/transactions${buildQuery({ ...params, limit: pageSize, offset })}`);
        const normalized = Array.isArray(rows) ? rows.map(normalizeTransaction) : [];
        results.push(...normalized);

        if (normalized.length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      return results;
    },
    async get(id) {
      const row = await client.get(`/transactions/${id}`);
      return normalizeTransaction(row);
    },
    create(data) {
      return client.post('/transactions', data).then((result) => {
        notifyTransactionsChanged();
        return normalizeTransaction(result);
      });
    },
    update(id, patch) {
      return client.patch(`/transactions/${id}`, patch).then((result) => {
        notifyTransactionsChanged();
        return normalizeTransaction(result);
      });
    },
    remove(id) {
      return client.delete(`/transactions/${id}`).then((result) => {
        notifyTransactionsChanged();
        return result;
      });
    },
  };
}

export const transactionsResource = createTransactionsResource();
