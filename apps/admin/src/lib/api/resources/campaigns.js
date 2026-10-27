import { apiClient } from '../client';
import { qs } from '../query';

export const campaignsResource = {
  list(params) {
    return apiClient.get(`/admin/campaigns${qs(params)}`);
  },
  get(id) {
    return apiClient.get(`/admin/campaigns/${id}`);
  },
  create(data) {
    return apiClient.post('/admin/campaigns', data);
  },
  update(id, data) {
    return apiClient.patch(`/admin/campaigns/${id}`, data);
  },
  remove(id) {
    return apiClient.delete(`/admin/campaigns/${id}`);
  },
  audience(segment) {
    return apiClient.post('/admin/campaigns/audience', { segment });
  },
  test(id, to) {
    return apiClient.post(`/admin/campaigns/${id}/test`, { to });
  },
  /** scheduledAt (ISO) is optional; without it the campaign is sent right away. */
  send(id, scheduledAt) {
    return apiClient.post(`/admin/campaigns/${id}/send`, scheduledAt ? { scheduledAt } : {});
  },
  sends(id, params) {
    return apiClient.get(`/admin/campaigns/${id}/sends${qs(params)}`);
  },
};
