import { apiClient } from '../client';

export function createCategorizationRulesResource({ client = apiClient } = {}) {
  return {
    list() {
      return client.get('/categorization-rules');
    },
    create(data) {
      return client.post('/categorization-rules', data);
    },
    update(id, patch) {
      return client.patch(`/categorization-rules/${id}`, patch);
    },
    recordUsage(id) {
      return client.post(`/categorization-rules/${id}/record-usage`);
    },
  };
}

export const categorizationRulesResource = createCategorizationRulesResource();
