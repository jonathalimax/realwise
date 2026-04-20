import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// These are live bindings — they start as undefined and are populated
// when initializeFirebase() is called before any component renders.
let app;
export let auth;
export let db;
export let storage;
export let functions;

/**
 * Called once by ClientConfigContext after loading the client config JSON.
 * Must be called before any component that uses auth/db/storage/functions renders.
 */
export function initializeFirebase(firebaseConfig, appName = '[DEFAULT]') {
  // SharedLogin creates the app as `user-{clientId}` before redirect.
  // Reuse that instance so the auth state (custom token sign-in) is preserved.
  const sharedLoginAppName = `user-${appName}`;
  const existing = getApps().find((a) => a.name === sharedLoginAppName || a.name === appName);
  app = existing ?? initializeApp(firebaseConfig, appName);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);

  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('[Firebase] Connected to Emulator Suite');
  }
}

export { app };
