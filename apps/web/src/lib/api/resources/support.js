import { apiClient } from '../client';

// Used until /support/config answers (and if it never does): the same details the reminder emails carry.
export const DEFAULT_SUPPORT = { whatsapp: '5541992310339', email: 'suporte@realwise.com.br' };

export function createSupportResource({ client = apiClient } = {}) {
  return {
    config() {
      return client.get('/support/config');
    },
    sendMessage({ message, name, email, subject }) {
      return client.post('/support/messages', { message, name, email, subject });
    },
    /** Permanently erases the account and every piece of data in it. */
    deleteAccount(confirm) {
      return client.delete('/account', { body: { confirm } });
    },
    announcement() {
      return client.get('/announcement');
    },
  };
}

export const supportResource = createSupportResource();
