import { apiClient } from '../client';
import { qs } from '../query';

export const usersResource = {
  list(params) {
    return apiClient.get(`/admin/users${qs(params)}`);
  },
  get(id) {
    return apiClient.get(`/admin/users/${id}`);
  },
  update(id, patch) {
    return apiClient.patch(`/admin/users/${id}`, patch);
  },
  /** body: { action: 'extend_trial'|'start_trial', days } | { action: 'grant_until', until: 'YYYY-MM-DD' } | { action: 'grant_lifetime' } | { action: 'revoke' } */
  plan(id, body) {
    return apiClient.post(`/admin/users/${id}/plan`, body);
  },
  /** role: 'admin' | 'user'. Not allowed on your own account. */
  setRole(id, role) {
    return apiClient.post(`/admin/users/${id}/role`, { role });
  },
  remove(id) {
    return apiClient.delete(`/admin/users/${id}`);
  },
};
