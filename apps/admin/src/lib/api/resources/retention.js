import { apiClient } from '../client';
import { qs } from '../query';

export const retentionResource = {
  settings() {
    return apiClient.get('/admin/retention/settings');
  },
  saveSettings(data) {
    return apiClient.put('/admin/retention/settings', data);
  },
  summary(days = 90) {
    return apiClient.get(`/admin/retention/summary${qs({ days })}`);
  },
};
