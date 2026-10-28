import { apiClient } from '../client';
import { qs } from '../query';

export const supportResource = {
  list(params) {
    return apiClient.get(`/admin/support${qs(params)}`);
  },
  stats() {
    return apiClient.get('/admin/support/stats');
  },
  get(id) {
    return apiClient.get(`/admin/support/${id}`);
  },
  reply(id, message) {
    return apiClient.post(`/admin/support/${id}/reply`, { message });
  },
  setStatus(id, status) {
    return apiClient.patch(`/admin/support/${id}`, { status });
  },
};
