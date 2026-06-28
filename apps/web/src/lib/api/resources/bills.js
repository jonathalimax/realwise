import { apiClient } from '../client';

const BILLS_CHANGED_EVENT = 'rw:bills:changed';

export function notifyBillsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BILLS_CHANGED_EVENT));
}

export function subscribeBillsChanged(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(BILLS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(BILLS_CHANGED_EVENT, listener);
}

export function createBillsResource({ client = apiClient } = {}) {
  return {
    list() {
      return client.get('/bills');
    },
    create(data) {
      return client.post('/bills', data);
    },
    update(id, patch) {
      return client.patch(`/bills/${id}`, patch);
    },
    markPaid(id, payload = {}) {
      return client.patch(`/bills/${id}/mark-paid`, payload);
    },
    remove(id) {
      return client.delete(`/bills/${id}`);
    },
  };
}

export const billsResource = createBillsResource();
