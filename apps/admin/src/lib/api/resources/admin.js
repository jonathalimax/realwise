import { apiClient } from '../client';

export function createAdminResource({ client = apiClient } = {}) {
  return {
    sendAdminEmail(data) {
      return client.post('/admin/emails/send', data);
    },
    listImportIssues() {
      return client.get('/admin/import-issues');
    },
    getImportIssue(id) {
      return client.get(`/admin/import-issues/${id}`);
    },
    updateImportIssue(id, patch) {
      return client.patch(`/admin/import-issues/${id}`, patch);
    },
  };
}

export const adminResource = createAdminResource();
