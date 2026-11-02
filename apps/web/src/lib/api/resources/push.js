import { apiClient } from '../client';

export const pushResource = {
  /** { publicKey, subscribed, devices } */
  config() {
    return apiClient.get('/push/config');
  },
  subscribe({ endpoint, p256dh, auth }) {
    return apiClient.post('/push/subscribe', { endpoint, p256dh, auth });
  },
  unsubscribe(endpoint) {
    return apiClient.post('/push/unsubscribe', { endpoint });
  },
  test() {
    return apiClient.post('/push/test', {});
  },
};
