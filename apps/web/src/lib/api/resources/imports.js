import { apiClient } from '../client';

export function createImportsResource({ client = apiClient } = {}) {
  return {
    reportIssue(data) {
      return client.post('/imports/report-issue', data);
    },
  };
}

export const importsResource = createImportsResource();
