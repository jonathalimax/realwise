import { apiClient } from '../client';

export function createGoalsResource({ client = apiClient } = {}) {
  return {
    list() {
      return client.get('/goals');
    },
    get(id) {
      return client.get(`/goals/${id}`);
    },
    create(data) {
      return client.post('/goals', data);
    },
    update(id, patch) {
      return client.patch(`/goals/${id}`, patch);
    },
    remove(id) {
      return client.delete(`/goals/${id}`);
    },
  };
}

export const goalsResource = createGoalsResource();
