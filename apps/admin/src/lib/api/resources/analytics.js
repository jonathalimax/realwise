import { apiClient } from '../client';
import { qs } from '../query';

export const analyticsResource = {
  overview(days = 30) {
    return apiClient.get(`/admin/analytics/overview${qs({ days })}`);
  },
  usersUsage({ sort = 'cost', limit = 10 } = {}) {
    return apiClient.get(`/admin/analytics/users-usage${qs({ sort, limit })}`);
  },
};
