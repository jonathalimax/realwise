import { apiClient } from '../client';

export function createAdminResource({ client = apiClient } = {}) {
  return {
    listLeads() {
      return client.get('/admin/leads');
    },
    updateLead(id, patch) {
      return client.patch(`/admin/leads/${id}`, patch);
    },
    listPurchases() {
      return client.get('/admin/purchases');
    },
    listTestimonials() {
      return client.get('/admin/testimonials');
    },
    createTestimonial(data) {
      return client.post('/admin/testimonials', data);
    },
    removeTestimonial(id) {
      return client.delete(`/admin/testimonials/${id}`);
    },
    sendAdminEmail(data) {
      return client.post('/admin/emails/send', data);
    },
    sendAbandonedCheckoutEmail(data) {
      return client.post('/admin/emails/send-abandoned-checkout', data);
    },
    startOnboardingRun(data) {
      return client.post('/admin/onboarding-runs', data);
    },
    getOnboardingRun(runId) {
      return client.get(`/admin/onboarding-runs/${runId}`);
    },
    listOnboardingRunLogs(runId) {
      return client.get(`/admin/onboarding-runs/${runId}/logs`);
    },
    transferClient(data) {
      return client.post('/admin/transfer-client', data);
    },
    getPricingConfig() {
      return client.get('/admin/pricing-config');
    },
    updatePricingConfig(patch) {
      return client.patch('/admin/pricing-config', patch);
    },
    listImportIssues() {
      return client.get('/admin/import-issues');
    },
    getImportIssue(id) {
      return client.get(`/admin/import-issues/${id}`);
    },
    updateImportIssue(id, patch) {
      return client.patch(`/admin/import-issues/${id}`, patch);
    },
  };
}

export const adminResource = createAdminResource();
