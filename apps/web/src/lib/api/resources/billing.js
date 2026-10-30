import { apiClient } from '../client';

export function createBillingResource({ client = apiClient } = {}) {
  return {
    listPlans() {
      return client.get('/billing/plans');
    },
    /** Same prices as listPlans(), for the anonymous landing page. */
    listPublicPlans() {
      return client.get('/billing/public-plans');
    },
    createCheckout(plan) {
      return client.post('/billing/checkout', { plan });
    },
    createPortal() {
      return client.post('/billing/portal');
    },
    /** Subscription details for the manage page (plan, renewal, price). */
    status() {
      return client.get('/billing/status');
    },
    /** Asks the server to re-read the subscription from Stripe (used right after Checkout). */
    sync(sessionId) {
      return client.post('/billing/sync', sessionId ? { sessionId } : {});
    },
    changePlan(plan) {
      return client.post('/billing/change-plan', { plan });
    },
    cancel() {
      return client.post('/billing/cancel');
    },
    resume() {
      return client.post('/billing/resume');
    },
  };
}

export const billingResource = createBillingResource();
