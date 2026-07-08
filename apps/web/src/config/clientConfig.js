const RESERVED = new Set(['app', 'www', 'realwise', 'localhost']);

/**
 * Extracts the client identifier from the hostname.
 * e.g. 'jonathalimax.realwise.com.br' → 'jonathalimax'
 * e.g. 'jonathalimax.localhost:5173'  → 'jonathalimax'
 * Returns null for apex, reserved subdomains, and bare localhost.
 */
export function extractClientId(hostname) {
  const host = hostname.split(':')[0]; // strip port
  const parts = host.split('.');
  const first = parts[0];
  if (RESERVED.has(first)) return null;
  if (parts.length < 2) return null;
  return first;
}

/**
 * Fetches the client config JSON from the hosting's public folder.
 * Used in production. Throws if response is not ok.
 */
export async function fetchClientConfig(clientId, signal) {
  const response = signal
    ? await fetch(`/clients/${clientId}.json`, { signal })
    : await fetch(`/clients/${clientId}.json`);
  if (!response.ok) {
    throw new Error(`Config not found for client: ${clientId} (${response.status})`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Config not found for client: ${clientId} (unexpected content-type)`);
  }
  return response.json();
}

export function resolveRuntimeConfigId({ isDev, clientEnv }) {
  if (isDev) {
    return clientEnv || 'app';
  }

  return 'app';
}

/**
 * Builds a config object from Vite env vars.
 * Used in development so we don't need a /clients/app.json locally.
 */
export function buildDevConfig() {
  return {
    clientName: 'Dev',
    stripePaymentLinkUrl: import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL || '',
    features: {
      investments: true,
      b3Sync: true,
      whatsapp: true,
      goals: true,
      salaryBreakdown: true,
    },
  };
}
