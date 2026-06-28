import { apiClient } from '../client';

const TRANSACTIONS_CHANGED_EVENT = 'rw:transactions:changed';

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
    list(params = {}) {
      return client.get(`/transactions${buildQuery(params)}`);
    },
    get(id) {
      return client.get(`/transactions/${id}`);
    },
    create(data) {
      return client.post('/transactions', data).then((result) => {
        notifyTransactionsChanged();
        return result;
      });
    },
    update(id, patch) {
      return client.patch(`/transactions/${id}`, patch).then((result) => {
        notifyTransactionsChanged();
        return result;
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
