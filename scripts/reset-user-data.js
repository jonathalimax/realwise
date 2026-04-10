#!/usr/bin/env node
/**
 * Reset a user's Firestore data.
 *
 * Usage:
 *   node scripts/reset-user-data.js --env=local --uid=<your-firebase-uid>
 *   node scripts/reset-user-data.js --env=prod  --uid=<your-firebase-uid>
 *
 * For --env=prod: requires scripts/service-account.json (download from Firebase Console
 * → Project Settings → Service Accounts → Generate new private key)
 *
 * For --env=local: no credentials needed — targets Firestore Emulator on localhost:8080
 */

import { createRequire } from 'module';
import { createInterface } from 'readline';

const require = createRequire(import.meta.url);

// Parse CLI flags (handles values that contain '=')
const args = {};
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue;
  const eqIdx = arg.indexOf('=');
  if (eqIdx === -1) {
    // Flag without value (e.g. --dry-run) — set to true
    args[arg.slice(2)] = true;
  } else {
    args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
  }
}

const env = args.env ?? 'local';
const uid = args.uid;

if (!uid) {
  console.error('Error: --uid=<firebase-user-uid> is required');
  console.error('Find your UID in Firebase Console → Authentication → Users');
  process.exit(1);
}

if (!['local', 'prod'].includes(env)) {
  console.error('Error: --env must be "local" or "prod"');
  process.exit(1);
}

// Collections to clear (all filtered by userId == uid)
const COLLECTIONS = [
  'transactions',
  'bills',
  'settings',
  'purchases',
  'pending_payments',
  'goals',
  'budgets',
  'cards',
  'investments',
];

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function deleteCollection(db, collectionName, userId) {
  const collectionRef = db.collection(collectionName);
  let deleted = 0;

  // Firestore batch delete limit is 500 writes
  while (true) {
    const snapshot = await collectionRef
      .where('userId', '==', userId)
      .limit(500)
      .get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
  }

  return deleted;
}

async function main() {
  // For local, point admin SDK at emulator before initialization
  if (env === 'local') {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    console.log('Target: Firebase Emulator (localhost:8080)');
  } else {
    // Explicitly clear in case it was set in the shell environment
    delete process.env.FIRESTORE_EMULATOR_HOST;
    console.log('Target: PRODUCTION Firestore (limas-finance)');
  }

  // Pre-flight: verify service-account.json exists before asking for confirmation
  if (env === 'prod') {
    try {
      require('./service-account.json');
    } catch {
      console.error('Error: scripts/service-account.json not found.');
      console.error('Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key');
      console.error('Save it to: scripts/service-account.json');
      process.exit(1);
    }
  }

  // Production requires explicit confirmation
  if (env === 'prod') {
    console.log('\n⚠️  WARNING: This will permanently delete all Firestore documents');
    console.log(`   for user UID: ${uid}`);
    console.log('   from the PRODUCTION database. This cannot be undone.\n');
    const answer = await confirm('Type DELETE to confirm: ');
    if (answer !== 'DELETE') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Initialize Firebase Admin SDK
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    try {
      admin = require('../functions/node_modules/firebase-admin');
    } catch {
      console.error('Error: firebase-admin not found.');
      console.error('Fix: cd functions && npm install');
      process.exit(1);
    }
  }

  if (admin.apps.length === 0) {
    if (env === 'prod') {
      const serviceAccount = require('./service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'limas-finance',
      });
    } else {
      admin.initializeApp({ projectId: 'limas-finance' });
    }
  }

  const db = admin.firestore();

  console.log(`\nDeleting data for UID: ${uid}`);
  console.log('Collections:', COLLECTIONS.join(', '), '\n');

  let totalDeleted = 0;
  for (const col of COLLECTIONS) {
    const count = await deleteCollection(db, col, uid);
    if (count > 0) {
      console.log(`  ✓ ${col}: ${count} document(s) deleted`);
    } else {
      console.log(`  - ${col}: nothing to delete`);
    }
    totalDeleted += count;
  }

  console.log(`\nDone. Deleted ${totalDeleted} document(s) across ${COLLECTIONS.length} collections.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
