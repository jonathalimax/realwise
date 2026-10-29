import { apiClient } from '../client';

export function createAdminResource({ client = apiClient } = {}) {
  return {
    sendAdminEmail(data) {
      return client.post('/admin/emails/send', data);
    },
  };
}

export const adminResource = createAdminResource();
