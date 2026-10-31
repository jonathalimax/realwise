import { apiClient } from '../client';
import { qs } from '../query';

export const invoicingResource = {
  settings() {
    return apiClient.get('/admin/invoicing/settings');
  },
  saveSettings(data) {
    return apiClient.put('/admin/invoicing/settings', data);
  },
  checkConnection() {
    return apiClient.post('/admin/invoicing/settings/check');
  },
  testEmission() {
    return apiClient.post('/admin/invoicing/settings/test-emission');
  },
  stats() {
    return apiClient.get('/admin/invoicing/stats');
  },
  list(params) {
    return apiClient.get(`/admin/invoicing${qs(params)}`);
  },
  backfill() {
    return apiClient.post('/admin/invoicing/backfill');
  },
  queueAll() {
    return apiClient.post('/admin/invoicing/queue-all');
  },
  issue(id) {
    return apiClient.post(`/admin/invoicing/${id}/issue`);
  },
  manualData(id) {
    return apiClient.get(`/admin/invoicing/${id}/manual-data`);
  },
  markManual(id, data) {
    return apiClient.post(`/admin/invoicing/${id}/manual`, data);
  },
  refresh(id) {
    return apiClient.post(`/admin/invoicing/${id}/refresh`);
  },
  skip(id, reason) {
    return apiClient.post(`/admin/invoicing/${id}/skip`, { reason });
  },
  cancel(id, reason) {
    return apiClient.post(`/admin/invoicing/${id}/cancel`, { reason });
  },
  updateCustomer(id, data) {
    return apiClient.patch(`/admin/invoicing/${id}/customer`, data);
  },
};
