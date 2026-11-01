import { apiClient } from '../client';

export const summaryResource = {
  /** Home "Insights do Elio": { tone, items: [{ title, detail, frees?, urgent?, href?, kind }] }. */
  insights() {
    return apiClient.get('/summary/insights');
  },
};
