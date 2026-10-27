import { apiClient } from '../client';
import { qs } from '../query';

export const settingsResource = {
  getAi() {
    return apiClient.get('/admin/settings/ai');
  },
  saveAi(value) {
    return apiClient.request('/admin/settings/ai', { method: 'PUT', body: value });
  },
  getEmails() {
    return apiClient.get('/admin/settings/emails');
  },
  saveEmails(value) {
    return apiClient.request('/admin/settings/emails', { method: 'PUT', body: value });
  },
  /** Reads the admin setting; falls back to the public banner endpoint when the admin GET is not available. */
  async getAnnouncement() {
    try {
      return await apiClient.get('/admin/settings/announcement');
    } catch (error) {
      if (error?.status !== 404 && error?.status !== 405) throw error;
      return apiClient.get('/announcement');
    }
  },
  saveAnnouncement(value) {
    return apiClient.request('/admin/settings/announcement', { method: 'PUT', body: value });
  },
  sendEmailTest({ kind, to }) {
    // The API names the bill-reminder sample 'bills'.
    return apiClient.post('/admin/settings/emails/test', { kind: kind === 'bill_reminder' ? 'bills' : kind, to });
  },
  runEmailJob(job) {
    return apiClient.post('/admin/emails/run-now', { job });
  },
  sentEmails(params) {
    return apiClient.get(`/admin/emails/sent${qs(params)}`);
  },
};
