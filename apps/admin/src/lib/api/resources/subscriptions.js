import { apiClient } from '../client';
import { qs } from '../query';

export const subscriptionsResource = {
  list(params) {
    return apiClient.get(`/admin/subscriptions${qs(params)}`);
  },
  /** Re-reads one user's subscription from Stripe (fixes a missed webhook). */
  sync(userId) {
    return apiClient.post(`/admin/subscriptions/${userId}/sync`);
  },
};
