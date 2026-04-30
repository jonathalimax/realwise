// src/lib/sharedFirebase.js
// Initialises a Firebase app bound to the shared project (public/clients/app.json).
// Exported instances are lazily initialised on first call to initSharedFirebase().

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const APP_NAME = 'shared';

/**
 * Fetch /clients/app.json, initialise the "shared" Firebase app (idempotent),
 * and return { auth, functions }.
 *
 * @returns {Promise<{ auth: import('firebase/auth').Auth, functions: import('firebase/functions').Functions }>}
 */
export async function initSharedFirebase() {
  // Return existing app if already initialised
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    return {
      auth: getAuth(existing),
      functions: getFunctions(existing),
    };
  }

  const res = await fetch('/clients/app.json');
  if (!res.ok) throw new Error(`Failed to load shared Firebase config: ${res.status}`);
  const config = await res.json();

  const app = initializeApp(config.firebase, APP_NAME);
  const auth = getAuth(app);
  const functions = getFunctions(app);

  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  return { auth, functions };
}
