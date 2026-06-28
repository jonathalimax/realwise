import { apiClient } from '../client';

export function createPlannerResource({ client = apiClient } = {}) {
  return {
    get() {
      return client.get('/planner');
    },
    update(payload) {
      return client.patch('/planner', payload);
    },
  };
}

export const plannerResource = createPlannerResource();
