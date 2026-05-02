#!/usr/bin/env node
// scripts/onboard-user.js
//
// Provisions a complete Firebase project for a new Realwise user.
//
// Usage:
//   node scripts/onboard-user.js <email> [billingAccountId]
//   BILLING_ACCOUNT_ID=XXXXXX node scripts/onboard-user.js mariasouza@gmail.com
//
// Prerequisites:
//   - `gcloud` CLI authenticated: gcloud auth login
//   - `firebase` CLI authenticated: firebase login
//   - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account key with:
//       roles/resourcemanager.projectCreator
//       roles/firebase.admin
//       roles/iam.serviceAccountAdmin
//       roles/iam.serviceAccountKeyAdmin
//   - BILLING_ACCOUNT_ID env var (or pass as 3rd CLI arg)
//   - SHARED_PROJECT_ID env var (defaults to limas-finance)
//
// DEPENDENCY CONCERN: `googleapis` is NOT in functions/package.json nor the root
// package.json. Install before running:
//   npm install --save-dev googleapis          (repo root)
//   -- or --
//   npm install -g googleapis                  (global)
//
// All execSync calls use only static string arguments — no user input is ever
// interpolated into the shell command string, so there is no injection risk.

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let google;
try {
  ({ google } = require('googleapis'));
} catch {
  console.error(
    'Error: `googleapis` package not found.\n' +
    'Install it first: npm install --save-dev googleapis\n'
  );
  process.exit(1);
}

let admin;
try {
  admin = require('../functions/node_modules/firebase-admin');
} catch {
  console.error(
    'Error: `firebase-admin` package not found.\n' +
    'Run: cd functions && npm install, then re-run from repo root.\n'
  );
  process.exit(1);
}

// ─── Config ────────────────────────────────────────────────────────────────

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/onboard-user.js <email> [billingAccountId]');
  process.exit(1);
}

// Sanitise username: lowercase, alphanumeric only
const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
const projectId = `realwise-${username}`;
const billingAccountId = process.argv[3] || process.env.BILLING_ACCOUNT_ID || '01F570-F17CDE-9379F7';
const sharedProjectId = process.env.SHARED_PROJECT_ID || 'realwise-ad9ec';
const repoRoot = path.resolve(__dirname, '..');

console.log('\nOnboarding user:', email);
console.log('  username    :', username);
console.log('  GCP project :', projectId);
console.log('  shared proj :', sharedProjectId, '\n');

// ─── Helpers ───────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log('$', cmd);
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  const resourceManager = google.cloudresourcemanager('v1');
  const serviceUsage = google.serviceusage('v1');
  const iam = google.iam('v1');
  const firebaseApi = google.firebase('v1beta1');
  const firestoreApi = google.firestore('v1');

  // ── Step 0: Ensure caller has billing.user on the billing account ─────────
  if (billingAccountId) {
    console.log('[0/9] Ensuring billing.user role on billing account...');
    try {
      const billing = google.cloudbilling('v1');
      const creds = await auth.getCredentials();
      if (!creds.client_email) throw new Error('Could not determine caller identity from credentials');
      const callerMember = `serviceAccount:${creds.client_email}`;

      const { data: billingPolicy } = await billing.billingAccounts.getIamPolicy({
        resource: `billingAccounts/${billingAccountId}`,
      });
      billingPolicy.bindings = billingPolicy.bindings || [];
      const billingRole = 'roles/billing.user';
      const existing = billingPolicy.bindings.find(b => b.role === billingRole);
      if (existing) {
        if (!existing.members.includes(callerMember)) existing.members.push(callerMember);
      } else {
        billingPolicy.bindings.push({ role: billingRole, members: [callerMember] });
      }
      await billing.billingAccounts.setIamPolicy({
        resource: `billingAccounts/${billingAccountId}`,
        requestBody: { policy: billingPolicy },
      });
      console.log('    billing.user granted to', callerMember);
    } catch (err) {
      console.warn('    Warning: could not ensure billing.user role:', err.message);
      console.warn(`    If step [2/9] fails, grant it manually and re-run.`);
    }
  }

  // ── Step 1: Create GCP project ───────────────────────────────────────────
  console.log('[1/9] Creating GCP project...');
  try {
    await resourceManager.projects.create({
      requestBody: { projectId, name: `Realwise ${username}` },
    });
    console.log('    Created project', projectId);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('    Project already exists — continuing');
    } else {
      throw err;
    }
  }

  // Wait for ACTIVE state (max 60 s)
  for (let i = 0; i < 20; i++) {
    const { data } = await resourceManager.projects.get({ projectId });
    if (data.lifecycleState === 'ACTIVE') break;
    if (data.lifecycleState === 'DELETE_REQUESTED') {
      throw new Error(
        `Project ${projectId} is scheduled for deletion. Restore it first:\n` +
        `  https://console.cloud.google.com/iam-admin/projects?organizationId=&project=${projectId}`
      );
    }
    console.log('    Waiting for ACTIVE...', data.lifecycleState);
    await sleep(3000);
  }

  // ── Step 2: Link billing account ─────────────────────────────────────────
  if (billingAccountId) {
    console.log('[2/9] Linking billing account...');
    const billing = google.cloudbilling('v1');
    await billing.projects.updateBillingInfo({
      name: `projects/${projectId}`,
      requestBody: { billingAccountName: `billingAccounts/${billingAccountId}` },
    });
    console.log('    Billing linked');
  } else {
    console.log('[2/9] Skipping billing link (BILLING_ACCOUNT_ID not set)');
  }

  // ── Step 3: Add Firebase to project ──────────────────────────────────────
  console.log('[3/9] Adding Firebase to project...');
  try {
    const op = await firebaseApi.projects.addFirebase({
      project: `projects/${projectId}`,
      requestBody: {},
    });
    let opName = op.data.name;
    let done = false;
    while (!done) {
      await sleep(4000);
      const { data: opData } = await firebaseApi.operations.get({ name: opName });
      done = opData.done;
      if (!done) console.log('    Waiting for Firebase provisioning...');
    }
    console.log('    Firebase added');
  } catch (err) {
    if (err.message?.includes('already')) {
      console.log('    Firebase already enabled — continuing');
    } else {
      throw err;
    }
  }

  // ── Step 4: Enable required APIs ─────────────────────────────────────────
  console.log('[4/9] Enabling Firestore + Auth APIs...');
  for (const api of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
    await serviceUsage.services.enable({
      name: `projects/${projectId}/services/${api}`,
      requestBody: {},
    });
    console.log('    Enabled', api);
    await sleep(1000);
  }

  // ── Step 4c: Initialize Firebase Auth ───────────────────────────────────
  console.log('[4c] Initializing Firebase Auth...');
  await sleep(5000); // allow identitytoolkit API to propagate
  try {
    // initializeAuth creates the auth config for the project (no Identity Platform required)
    await authClient.request({
      url: `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
      method: 'POST',
      headers: { 'x-goog-user-project': projectId },
      data: {},
    });
    console.log('    Firebase Auth initialized');
  } catch (err) {
    if (err.status === 409 || err.message?.includes('already') || err.message?.includes('ALREADY')) {
      console.log('    Firebase Auth already initialized — continuing');
    } else {
      console.warn('    Warning: Auth init returned:', err.message);
    }
  }

  // ── Step 4b: Create Firestore database in São Paulo ──────────────────────
  console.log('[4b] Creating Firestore database (southamerica-east1)...');
  try {
    const dbOp = await firestoreApi.projects.databases.create({
      parent: `projects/${projectId}`,
      databaseId: '(default)',
      requestBody: {
        locationId: 'southamerica-east1',
        type: 'FIRESTORE_NATIVE',
      },
    });
    // Wait for operation to complete
    let done = false;
    while (!done) {
      await sleep(3000);
      const { data: opData } = await firestoreApi.projects.databases.operations.get({
        name: dbOp.data.name,
      });
      done = opData.done;
      if (!done) console.log('    Waiting for Firestore database creation...');
    }
    console.log('    Firestore database created in southamerica-east1');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('    Firestore database already exists — skipping');
    } else {
      throw err;
    }
  }

  // ── Step 5: Create Firebase web app + fetch SDK config ───────────────────
  console.log('[5/9] Creating Firebase web app...');
  let sdkConfig;

  const fetchSdkConfig = async (appId) => {
    const { data: configData } = await firebaseApi.projects.webApps.getConfig({
      name: `projects/${projectId}/webApps/${appId}/config`,
    });
    return {
      apiKey: configData.apiKey,
      authDomain: configData.authDomain,
      projectId: configData.projectId,
      storageBucket: configData.storageBucket,
      messagingSenderId: configData.messagingSenderId,
      appId: configData.appId,
    };
  };

  try {
    const createOp = await firebaseApi.projects.webApps.create({
      parent: `projects/${projectId}`,
      requestBody: { displayName: `Realwise ${username}` },
    });
    let opName = createOp.data.name;
    let appData;
    let done = false;
    while (!done) {
      await sleep(3000);
      const { data: opData } = await firebaseApi.operations.get({ name: opName });
      done = opData.done;
      if (done) appData = opData.response;
      else console.log('    Waiting for web app creation...');
    }
    console.log('    Web app created:', appData?.appId);
    sdkConfig = await fetchSdkConfig(appData.appId);
  } catch (err) {
    if (err.message?.includes('already')) {
      console.log('    Web app already exists — fetching config...');
      const { data } = await firebaseApi.projects.webApps.list({
        parent: `projects/${projectId}`,
      });
      sdkConfig = await fetchSdkConfig(data.apps[0].appId);
    } else {
      throw err;
    }
  }
  console.log('    SDK config fetched');

  // ── Step 6: Create service account ───────────────────────────────────────
  console.log('[6/9] Creating service account...');
  const saId = 'realwise-admin';
  const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;

  try {
    await iam.projects.serviceAccounts.create({
      name: `projects/${projectId}`,
      requestBody: {
        accountId: saId,
        serviceAccount: { displayName: 'Realwise Admin' },
      },
    });
    console.log('    Service account created:', saEmail);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('    Service account already exists — continuing');
    } else {
      throw err;
    }
  }

  // Grant Firebase Admin role
  const crm = google.cloudresourcemanager('v1');
  const { data: policy } = await crm.projects.getIamPolicy({
    resource: projectId,
    requestBody: {},
  });
  policy.bindings = policy.bindings || [];
  const adminRole = 'roles/firebase.admin';
  const member = `serviceAccount:${saEmail}`;
  const binding = policy.bindings.find((b) => b.role === adminRole);
  if (binding) {
    if (!binding.members.includes(member)) binding.members.push(member);
  } else {
    policy.bindings.push({ role: adminRole, members: [member] });
  }
  await crm.projects.setIamPolicy({ resource: projectId, requestBody: { policy } });
  console.log('    Granted roles/firebase.admin to service account');

  // ── Step 7: Generate private key ─────────────────────────────────────────
  console.log('[7/9] Generating private key...');
  const { data: keyData } = await iam.projects.serviceAccounts.keys.create({
    name: `projects/${projectId}/serviceAccounts/${saEmail}`,
    requestBody: { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' },
  });
  const serviceAccountJson = JSON.parse(
    Buffer.from(keyData.privateKeyData, 'base64').toString('utf8')
  );
  console.log('    Private key generated');

  // ── Step 8: Store service account in shared Firestore ────────────────────
  console.log('[8/10] Writing service account to shared Firestore...');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: sharedProjectId });
  }
  const sharedDb = admin.firestore();
  await sharedDb.collection('serviceAccounts').doc(username).set(serviceAccountJson);
  console.log('    serviceAccounts/' + username + ' written');

  // ── Step 9: Create Firebase Auth user in new project ─────────────────────
  console.log('[9/11] Creating Firebase Auth user...');
  // Call the Identity Toolkit Admin REST API directly using the existing authClient
  // (which already has the project owner's OAuth token). This avoids Firebase Admin
  // SDK quota-project issues with ADC user credentials.
  const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + '!1';
  let userCreated = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await authClient.request({
        url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
        method: 'POST',
        headers: { 'x-goog-user-project': projectId },
        data: {
          localId: username, // UID must match what getCustomToken mints the token for
          email,
          password: tempPassword,
          displayName: username,
          emailVerified: false,
          disabled: false,
        },
      });
      console.log('    Auth user created');
      console.log('    Temp password:', tempPassword);
      userCreated = true;
      break;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('EMAIL_EXISTS') || msg.includes('email-already-exists')) {
        console.log('    Auth user already exists — skipping');
        userCreated = true;
        break;
      }
      if (attempt < 10) {
        console.log(`    Auth not ready yet (attempt ${attempt}/10), retrying in 6s... [${msg.slice(0, 80)}]`);
        await sleep(6000);
      } else {
        throw err;
      }
    }
  }
  // ── Step 9b: Seed access/allowed_emails + deploy Firestore rules ─────────
  console.log('[9b] Seeding access whitelist and deploying Firestore rules...');
  // Wait for the new service account key to propagate before using it
  console.log('    Waiting 15s for service account key to propagate...');
  await sleep(15000);
  const clientApp = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccountJson), projectId },
    'client'
  );
  const clientDb = clientApp.firestore();
  // Retry in case Firestore or credentials are still warming up
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await clientDb.collection('access').doc('allowed_emails').set({ emails: [email] });
      break;
    } catch (err) {
      if (attempt < 5 && (err.code === 16 || err.message?.includes('UNAUTHENTICATED'))) {
        console.log(`    Credentials not ready (attempt ${attempt}/5), retrying in 10s...`);
        await sleep(10000);
      } else {
        throw err;
      }
    }
  }
  console.log('    access/allowed_emails seeded with', email);

  // Deploy Firestore rules to allow public read of access/allowed_emails
  const rulesContent = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /access/allowed_emails {
      allow read: if true;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  const rulesPath = path.join(repoRoot, 'firestore.client.rules');
  fs.writeFileSync(rulesPath, rulesContent, 'utf8');
  run(`firebase deploy --only firestore:rules --project ${projectId} --config firestore-client.json`, { cwd: repoRoot });
  fs.unlinkSync(rulesPath);

  await admin.app('client').delete();

  // ── Step 9c: Authorize realwise.com.br in client Auth settings ────────
  console.log('[9c] Authorizing realwise.com.br in client Auth...');
  try {
    const { data: authConfig } = await authClient.request({
      url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
      method: 'GET',
      headers: { 'x-goog-user-project': projectId },
    });
    const existing = authConfig.authorizedDomains || [];
    const toAdd = 'realwise.com.br';
    if (!existing.includes(toAdd)) {
      await authClient.request({
        url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
        method: 'PATCH',
        params: { updateMask: 'authorizedDomains' },
        headers: { 'x-goog-user-project': projectId },
        data: { authorizedDomains: [...existing, toAdd] },
      });
      console.log('    realwise.com.br authorized');
    } else {
      console.log('    Already authorized — skipping');
    }
  } catch (err) {
    console.warn('    Warning: could not update authorized domains:', err.message);
  }

  // ── Step 10: Write public/clients/{username}.json + deploy ────────────────
  console.log('[10/11] Writing client config + deploying hosting...');
  const clientConfig = {
    clientName: 'Realwise',
    firebase: sdkConfig,
    features: {
      investments: true,
      goals: false,
      b3Sync: true,
      whatsapp: false,
      salaryBreakdown: true,
    },
  };
  const configPath = path.join(repoRoot, 'public', 'clients', `${username}.json`);
  fs.writeFileSync(configPath, JSON.stringify(clientConfig, null, 2) + '\n', 'utf8');
  console.log('    Written', configPath);

  // Build first so the new client JSON lands in dist/ before hosting deploy
  run('npm run build', { cwd: repoRoot });
  run(
    `firebase deploy --only hosting --project ${sharedProjectId}`,
    { cwd: repoRoot }
  );

  // ── Step 11: Mark lead as active in shared Firestore ─────────────────────
  console.log('[11/11] Updating lead state to active...');
  await sharedDb.collection('leads').doc(email).set(
    { state: 'active', activatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  console.log('    Lead state → active');

  console.log('\nOnboarding complete for', email);
  console.log('  Login URL :', `https://${username}.realwise.com.br/login`);
  console.log('  Dashboard :', `https://${username}.realwise.com.br/dashboard\n`);
}

main().catch((err) => {
  console.error('\nOnboarding failed:', err.message || err);
  process.exit(1);
});
