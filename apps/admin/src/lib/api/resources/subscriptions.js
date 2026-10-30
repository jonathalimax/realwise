import { apiClient } from '../client';
import { qs } from '../query';

export const subscriptionsResource = {
  list(params) {
    return apiClient.get(`/admin/subscriptions${qs(params)}`);
  },
  /** Is Stripe configured to call this API (URL, enabled, events, secret)? */
  webhookHealth() {
    return apiClient.get('/admin/subscriptions/webhook-health');
  },
  syncAllStatus() {
    return apiClient.get('/admin/subscriptions/sync-all');
  },
  /** Starts the background catch-up of every Stripe customer; poll syncAllStatus() for progress. */
  startSyncAll() {
    return apiClient.post('/admin/subscriptions/sync-all');
  },
  /** Re-reads one user's subscription from Stripe (fixes a missed webhook). */
  sync(userId) {
    return apiClient.post(`/admin/subscriptions/${userId}/sync`);
  },
};
