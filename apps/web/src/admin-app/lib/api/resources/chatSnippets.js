import { apiClient } from '../client';

export const chatSnippetsResource = {
  list() {
    return apiClient.get('/admin/chat-snippets');
  },
  save(key, value) {
    return apiClient.request(`/admin/chat-snippets/${encodeURIComponent(key)}`, { method: 'PUT', body: value });
  },
};
