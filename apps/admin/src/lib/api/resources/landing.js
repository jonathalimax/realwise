import { apiClient } from '../client';
import { qs } from '../query';

export const landingResource = {
  stats(days = 30) {
    return apiClient.get(`/admin/landing/stats${qs({ days })}`);
  },
  listLeads() {
    return apiClient.get('/admin/leads');
  },
  updateLead(id, patch) {
    return apiClient.patch(`/admin/leads/${id}`, patch);
  },
};

export const couponsResource = {
  list() {
    return apiClient.get('/admin/coupons');
  },
  create(data) {
    return apiClient.post('/admin/coupons', data);
  },
  setActive(id, active) {
    return apiClient.patch(`/admin/coupons/${id}`, { active });
  },
};
