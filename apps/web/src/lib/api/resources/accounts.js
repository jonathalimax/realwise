import { apiClient } from '../client';

export function createAccountsResource({ client = apiClient } = {}) {
  return {
    list() {
      return client.get('/accounts');
    },
    create(data) {
      return client.post('/accounts', data);
    },
    update(id, patch) {
      return client.patch(`/accounts/${id}`, patch);
    },
    remove(id) {
      return client.delete(`/accounts/${id}`);
    },
  };
}

export const accountsResource = createAccountsResource();
