import { apiClient } from '../client';

export const simulatorResource = {
  messages() {
    return apiClient.get('/admin/simulator/messages');
  },
  reset({ interview = false } = {}) {
    return apiClient.post('/admin/simulator/reset', { interview });
  },
  send(message) {
    return apiClient.post('/admin/simulator/send', { message });
  },
  answer(messageId, answers) {
    return apiClient.post(`/admin/simulator/messages/${messageId}/answers`, { answers });
  },
  accountForm(messageId, form) {
    return apiClient.post(`/admin/simulator/messages/${messageId}/account-form`, form);
  },
  ops(messages) {
    return apiClient.post('/admin/simulator/ops', { messages });
  },
};
