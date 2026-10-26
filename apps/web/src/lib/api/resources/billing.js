import { apiClient } from '../client';

export function createBillingResource({ client = apiClient } = {}) {
  return {
    listPlans() {
      return client.get('/billing/plans');
    },
    createCheckout(plan) {
      return client.post('/billing/checkout', { plan });
    },
    createPortal() {
      return client.post('/billing/portal');
    },
  };
}

export const billingResource = createBillingResource();
