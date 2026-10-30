import { apiClient } from '../client';

export const summaryResource = {
  /** Builds a user's summary and returns its private link; with send=true also e-mails it to the admin (never to the user). */
  preview(body) {
    return apiClient.post('/admin/summary/preview', body);
  },
};
