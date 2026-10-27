import { apiClient } from '../client';
import { apiUrl, qs } from '../query';

export const llmLogsResource = {
  list(params) {
    return apiClient.get(`/admin/llm-logs${qs(params)}`);
  },
  summary({ from, to } = {}) {
    return apiClient.get(`/admin/llm-logs/summary${qs({ from, to })}`);
  },
  /** Link used by a plain <a download>; the session cookie authenticates it. */
  exportUrl(params) {
    return apiUrl('/admin/llm-logs/export.csv', params);
  },
};
