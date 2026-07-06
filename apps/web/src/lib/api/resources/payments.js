import { apiClient } from '../client';

export function createPaymentsResource({ client = apiClient } = {}) {
  return {
    createStripeCheckout(payload) {
      return client.post('/payments/stripe/checkout', payload);
    },
    createMercadoPagoQuote(payload) {
      return client.post('/payments/mercadopago/quote', payload);
    },
    processMercadoPagoPayment(payload) {
      return client.post('/payments/mercadopago/process', payload);
    },
    savePartialLead(payload) {
      return client.post('/payments/partial-lead', payload);
    },
  };
}

export const paymentsResource = createPaymentsResource();
