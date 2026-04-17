const RESERVED_PATHS = ['__', 'api', 'clients', 'purchase-success', 'login'];

/**
 * Extracts the client identifier from the URL pathname.
 * e.g. '/clienta/dashboard' → 'clienta'
 * Falls back to 'app' for root or reserved paths.
 */
export function extractClientId(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (!first || RESERVED_PATHS.includes(first)) return 'app';
  return first;
}

/**
 * Fetches the client config JSON from the hosting's public folder.
 * Used in production. Throws if response is not ok.
 */
export async function fetchClientConfig(clientId) {
  const response = await fetch(`/clients/${clientId}.json`);
  if (!response.ok) {
    throw new Error(`Config not found for client: ${clientId} (${response.status})`);
  }
  return response.json();
}

/**
 * Builds a config object from Vite env vars.
 * Used in development so we don't need a /clients/app.json locally.
 */
export function buildDevConfig() {
  return {
    clientName: 'Dev',
    firebase: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    },
    features: {
      investments: true,
      b3Sync: true,
      whatsapp: true,
      goals: true,
      salaryBreakdown: true,
    },
  };
}
