import { apiClient } from '../client';
import { qs } from '../query';

export const errorsResource = {
  summary() {
    return apiClient.get('/admin/errors/summary');
  },
  list(params) {
    return apiClient.get(`/admin/errors${qs(params)}`);
  },
  get(fingerprint) {
    return apiClient.get(`/admin/errors/${fingerprint}`);
  },
  /** status: 'open' | 'resolved' | 'ignored' */
  setStatus(fingerprint, status) {
    return apiClient.patch(`/admin/errors/${fingerprint}`, { status });
  },
};
