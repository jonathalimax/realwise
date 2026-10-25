import { apiClient } from '../client';
import { notifyTransactionsChanged } from './transactions';
import { notifyBillsChanged } from './bills';

export function createChatResource({ client = apiClient } = {}) {
  return {
    messages() {
      return client.get('/chat/messages');
    },
    /** Sends text and/or files; resolves to { userMessage, assistantMessage }. */
    async send({ message = '', files = [] }) {
      const form = new FormData();
      if (message) form.append('message', message);
      files.forEach((file) => form.append('files', file));
      const result = await client.post('/chat/messages', form);
      // The assistant may have saved transactions or bills: refresh any screen showing them.
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    /** Answers a question sheet; John continues and replies. */
    async answer(messageId, answers) {
      const result = await client.post(`/chat/messages/${messageId}/answers`, { answers });
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    /** Confirms categories for rows that were already saved. No model call. */
    async applyReview(messageId, decisions) {
      const result = await client.post(`/chat/messages/${messageId}/review`, { decisions });
      notifyTransactionsChanged();
      return result;
    },
    async undoImport(importId) {
      const result = await client.post(`/chat/imports/${importId}/undo`);
      notifyTransactionsChanged();
      return result;
    },
    insights(month) {
      return client.get(`/chat/insights?month=${encodeURIComponent(month)}`);
    },
  };
}

export const chatResource = createChatResource();
