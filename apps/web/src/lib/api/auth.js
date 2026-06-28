import { apiClient, createApiClient } from './client';

export function createAuthApi(clientOptions) {
  const client = clientOptions ? createApiClient(clientOptions) : apiClient;

  return {
    getSession() {
      return client.get('/auth/me');
    },
    refresh() {
      return client.post('/auth/refresh');
    },
    logout() {
      return client.post('/auth/logout');
    },
  };
}

export const authApi = createAuthApi();
