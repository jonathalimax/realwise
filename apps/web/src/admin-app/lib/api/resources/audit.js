import { apiClient } from '../client';
import { qs } from '../query';

export const auditResource = {
  list(params) {
    return apiClient.get(`/admin/audit${qs(params)}`);
  },
};
