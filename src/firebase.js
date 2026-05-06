import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
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
export async function initializeFirebase(firebaseConfig, appName = '[DEFAULT]') {
  const existing = getApps().find(a => a.name === appName);
  if (existing) {
    const existingProjectId = existing.options.projectId;
    if (existingProjectId !== firebaseConfig.projectId) {
      // Different Firebase project for the same appName — tear down and reinitialize.
      const staleDb = getFirestore(existing);
      try {
        await terminate(staleDb);
      } catch (_) {
        // Best-effort: ignore errors during cleanup
      }
      await deleteApp(existing);
    } else {
      // Same project — reuse existing app.
      // DO NOT call setPersistence here: calling it after sign-in clears the
      // auth session (hypothesis D). Persistence was already set (or defaults
      // to browserLocal) when the app was first initialized.
      app = existing;
      auth = getAuth(app);
      console.log('[debug-auth] REUSING app', app.name, existing.options.projectId, 'currentUser uid:', auth.currentUser?.uid);
      db = getFirestore(app);
      storage = getStorage(app);
      functions = getFunctions(app);
      return;
    }
  }

  app = initializeApp(firebaseConfig, appName);
  auth = getAuth(app);
  console.log('[debug-auth] FIRST INIT app', appName, firebaseConfig.projectId);
  await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
    setPersistence(auth, browserLocalPersistence)
  );
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);

  if (import.meta.env.DEV) {
    // Idempotent emulator connection — `connectAuthEmulator` throws
    // `auth/emulator-config-failed` when the Auth instance has already been
    // used or already has an emulator binding. That's fine — already connected.
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    } catch (e) {
      if (e?.code !== 'auth/emulator-config-failed') throw e;
    }
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (e) {
      // Firestore throws when reconnecting to the same emulator — ignore.
    }
    try {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    } catch (e) {
      // Functions reconnection is harmless to ignore.
    }
    console.log('[Firebase] Connected to Emulator Suite');
  }
}

export { app };
