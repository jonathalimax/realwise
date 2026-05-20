'use strict';

const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const crypto = require('crypto');
const zlib = require('zlib');
const nodemailer = require('nodemailer');
const { promisify } = require('util');
const { accessGrantedTemplate } = require('./emailTemplates');

const gzip = promisify(zlib.gzip);
const db = admin.firestore();

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');
const emailHostSecret = defineSecret('EMAIL_HOST');
const emailPortSecret = defineSecret('EMAIL_PORT');
const gcloudCredsSecret = defineSecret('GCLOUD_USER_CREDENTIALS');

const BILLING_ACCOUNT_ID = '01F570-F17CDE-9379F7';
const SHARED_PROJECT_ID = 'moneywise-ad9ec';
const HOSTING_SITE_ID = 'mymoneywise'; // Firebase Hosting site (realwise.com.br custom domain)

// Operator: deploy-only access (no Firestore/Storage/Auth data)
const OPERATOR_EMAIL = 'jonathalimax@gmail.com';
const OPERATOR_ROLES = [
  'roles/cloudfunctions.developer',
  'roles/firebasehosting.admin',
  'roles/cloudbuild.builds.editor',
  'roles/artifactregistry.writer',
  'roles/iam.serviceAccountUser',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function log(runId, step, message, level = 'info') {
  await db.collection('onboardingRuns').doc(runId).collection('logs').add({
    step, message, level,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteCollection(ref, batchSize = 100) {
  const snap = await ref.limit(batchSize).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size === batchSize) await deleteCollection(ref, batchSize);
}

async function runStep(runId, runRef, stepNum, description, fn) {
  await log(runId, stepNum, `Starting: ${description}`);
  try {
    const result = await fn();
    await log(runId, stepNum, result || `Done: ${description}`, 'success');
    return true;
  } catch (err) {
    await log(runId, stepNum, `FAILED: ${description} — ${err.message}`, 'error');
    await runRef.update({ status: 'failed', error: err.message });
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAuthClient() {
  // Prefer stored user credentials (needed to create "no org" GCP projects)
  const credsJson = gcloudCredsSecret.value();
  if (credsJson) {
    const creds = JSON.parse(credsJson);
    const client = google.auth.fromJSON(creds);
    // quota_project_id may be embedded in the JSON; ensure it's set
    if (!client.quotaProjectId) client.quotaProjectId = SHARED_PROJECT_ID;
    return client;
  }
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  });
  return auth.getClient();
}

// ─── Hosting REST API helper ────────────────────────────────────────────────
// Adds a single JSON file to the live hosting release without a full rebuild.

async function deployFileToHosting(authClient, siteId, filePath, content) {
  const base = 'https://firebasehosting.googleapis.com/v1beta1';
  const token = (await authClient.getAccessToken()).token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1 — get current live version's files so we can reuse their hashes
  const releasesRes = await fetch(`${base}/sites/${siteId}/releases?pageSize=1`, { headers });
  const releasesData = await releasesRes.json();
  const currentVersionName = releasesData.releases?.[0]?.version?.name;

  const existingFiles = {};
  if (currentVersionName) {
    let pageToken;
    do {
      const url = `${base}/${currentVersionName}/files?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const filesRes = await fetch(url, { headers });
      const filesData = await filesRes.json();
      for (const f of filesData.files || []) {
        existingFiles[f.path] = f.hash;
      }
      pageToken = filesData.nextPageToken;
    } while (pageToken);
  }

  // 2 — gzip the new file and compute its SHA256
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const compressed = await gzip(buf);
  const hash = crypto.createHash('sha256').update(compressed).digest('hex');

  // 3 — create new version
  const versionRes = await fetch(`${base}/sites/${siteId}/versions`, {
    method: 'POST', headers,
    body: JSON.stringify({ config: { headers: [] } }),
  });
  const versionData = await versionRes.json();
  const versionName = versionData.name;

  // 4 — populate: existing files + new file
  const fileHashes = { ...existingFiles, [filePath]: hash };
  const populateRes = await fetch(`${base}/${versionName}:populateFiles`, {
    method: 'POST', headers,
    body: JSON.stringify({ files: fileHashes }),
  });
  const populateData = await populateRes.json();
  const uploadRequiredHashes = new Set(populateData.uploadRequiredHashes || []);

  // 5 — upload files whose hash wasn't already stored
  if (uploadRequiredHashes.has(hash)) {
    const uploadToken = (await authClient.getAccessToken()).token;
    // uploadUrl comes from the populateFiles response — use it directly
    const uploadBaseUrl = populateData.uploadUrl;
    await fetch(`${uploadBaseUrl}/${hash}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Protocol': 'raw',
      },
      body: compressed,
    });
  }

  // 6 — finalize
  await fetch(`${base}/${versionName}?updateMask=status`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ status: 'FINALIZED' }),
  });

  // 7 — release
  await fetch(`${base}/sites/${siteId}/releases?versionName=${versionName}`, {
    method: 'POST', headers, body: '{}',
  });
}

// ─── Cloud Function ────────────────────────────────────────────────────────

exports.onboardUser = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB', secrets: [emailUserSecret, emailPasswordSecret, emailHostSecret, emailPortSecret, gcloudCredsSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

    const { email, runId } = data;
    if (!email || !runId) throw new functions.https.HttpsError('invalid-argument', 'email and runId are required');

    const runRef = db.collection('onboardingRuns').doc(runId);
    await runRef.set({ email, status: 'queued', createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    // Clean up old runs (> 60 days)
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oldRuns = await db.collection('onboardingRuns').where('startedAt', '<', cutoff).get();
    for (const oldRun of oldRuns.docs) {
      await deleteCollection(oldRun.ref.collection('logs'));
      await oldRun.ref.delete();
    }

    await runRef.set({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const projectId = `realwise-${username}`;
    const step = (num, desc, fn) => runStep(runId, runRef, num, desc, fn);

    const authClient = await getAuthClient();
    google.options({ auth: authClient });

    const resourceManager = google.cloudresourcemanager('v1');
    const serviceUsage = google.serviceusage('v1');
    const iam = google.iam('v1');
    const firebaseApi = google.firebase('v1beta1');
    const firestoreApi = google.firestore('v1');

    // ── Step 1: Create GCP project ─────────────────────────────────────────
    if (!(await step(1, `Create GCP project ${projectId}`, async () => {
      try {
        await resourceManager.projects.create({
          requestBody: { projectId, name: `Realwise ${username}` },
        });
      } catch (err) {
        if (!err.message?.includes('already exists')) throw err;
      }
      for (let i = 0; i < 20; i++) {
        const { data: p } = await resourceManager.projects.get({ projectId });
        if (p.lifecycleState === 'ACTIVE') break;
        if (p.lifecycleState === 'DELETE_REQUESTED') throw new Error(`Project ${projectId} is scheduled for deletion`);
        await sleep(3000);
      }
      return `GCP project ${projectId} is ACTIVE`;
    }))) return;

    // ── Step 2: Link billing account ──────────────────────────────────────
    if (!(await step(2, 'Link billing account', async () => {
      const billing = google.cloudbilling('v1');
      try {
        await billing.projects.updateBillingInfo({
          name: `projects/${projectId}`,
          requestBody: { billingAccountName: `billingAccounts/${BILLING_ACCOUNT_ID}` },
        });
      } catch (err) {
        // "Precondition check failed" means billing is already linked
        if (!err.message?.includes('Precondition')) throw err;
      }
      return 'Billing account linked';
    }))) return;

    // ── Step 3: Add Firebase to project ───────────────────────────────────
    if (!(await step(3, 'Add Firebase to project', async () => {
      try {
        const op = await firebaseApi.projects.addFirebase({ project: `projects/${projectId}`, requestBody: {} });
        let done = false;
        while (!done) {
          await sleep(4000);
          const { data: opData } = await firebaseApi.operations.get({ name: op.data.name });
          done = opData.done;
        }
      } catch (err) {
        if (!err.message?.includes('already')) throw err;
      }
      return 'Firebase added to project';
    }))) return;

    // ── Step 4: Enable APIs + create Firestore DB + init Auth ─────────────
    if (!(await step(4, 'Enable APIs & initialize Firebase services', async () => {
      // Billing propagation can take up to ~2 min after linking — retry with backoff
      for (const api of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
        let lastErr;
        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            await serviceUsage.services.enable({ name: `projects/${projectId}/services/${api}`, requestBody: {} });
            lastErr = null;
            break;
          } catch (err) {
            if (err.message?.includes('billing')) {
              lastErr = err;
              await sleep(20000); // wait 20s for billing to propagate
            } else {
              throw err;
            }
          }
        }
        if (lastErr) throw lastErr;
        await sleep(1000);
      }
      await sleep(5000);

      // Init Firebase Auth
      try {
        await authClient.request({
          url: `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
          method: 'POST', headers: { 'x-goog-user-project': projectId }, data: {},
        });
      } catch (err) {
        if (!(err.status === 409 || err.message?.includes('already') || err.message?.includes('ALREADY'))) {
          console.warn('[onboardUser] Auth init warning:', err.message);
        }
      }

      // Create Firestore DB in São Paulo
      try {
        const dbOp = await firestoreApi.projects.databases.create({
          parent: `projects/${projectId}`,
          databaseId: '(default)',
          requestBody: { locationId: 'southamerica-east1', type: 'FIRESTORE_NATIVE' },
        });
        let done = false;
        while (!done) {
          await sleep(3000);
          const { data: opData } = await firestoreApi.projects.databases.operations.get({ name: dbOp.data.name });
          done = opData.done;
        }
      } catch (err) {
        if (!err.message?.includes('already exists')) throw err;
      }

      return 'APIs enabled, Firestore created, Auth initialized';
    }))) return;

    // ── Step 5: Create Firebase web app + fetch SDK config ────────────────
    let sdkConfig;
    if (!(await step(5, 'Create Firebase web app & fetch SDK config', async () => {
      const fetchSdkConfig = async (appId) => {
        const { data } = await firebaseApi.projects.webApps.getConfig({
          name: `projects/${projectId}/webApps/${appId}/config`,
        });
        return { apiKey: data.apiKey, authDomain: data.authDomain, projectId: data.projectId,
          storageBucket: data.storageBucket, messagingSenderId: data.messagingSenderId, appId: data.appId };
      };
      try {
        const createOp = await firebaseApi.projects.webApps.create({
          parent: `projects/${projectId}`,
          requestBody: { displayName: `Realwise ${username}` },
        });
        let appData, done = false;
        while (!done) {
          await sleep(3000);
          const { data: opData } = await firebaseApi.operations.get({ name: createOp.data.name });
          done = opData.done;
          if (done) appData = opData.response;
        }
        sdkConfig = await fetchSdkConfig(appData.appId);
      } catch (err) {
        if (err.message?.includes('already')) {
          const { data } = await firebaseApi.projects.webApps.list({ parent: `projects/${projectId}` });
          sdkConfig = await fetchSdkConfig(data.apps[0].appId);
        } else throw err;
      }
      return `Web app created, SDK config fetched (appId: ${sdkConfig.appId})`;
    }))) return;

    // ── Step 6: Create service account + grant firebase.admin ────────────
    const saId = 'realwise-admin';
    const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;
    if (!(await step(6, 'Create service account & grant IAM roles', async () => {
      try {
        await iam.projects.serviceAccounts.create({
          name: `projects/${projectId}`,
          requestBody: { accountId: saId, serviceAccount: { displayName: 'Realwise Admin' } },
        });
      } catch (err) {
        if (!err.message?.includes('already exists')) throw err;
      }
      await sleep(10000); // wait for SA to propagate before binding IAM roles
      const crm = google.cloudresourcemanager('v1');
      const { data: policy } = await crm.projects.getIamPolicy({ resource: projectId, requestBody: {} });
      policy.bindings = policy.bindings || [];
      const member = `serviceAccount:${saEmail}`;
      const binding = policy.bindings.find((b) => b.role === 'roles/firebase.admin');
      if (binding) { if (!binding.members.includes(member)) binding.members.push(member); }
      else policy.bindings.push({ role: 'roles/firebase.admin', members: [member] });
      await crm.projects.setIamPolicy({ resource: projectId, requestBody: { policy } });
      return `Service account ${saEmail} created with roles/firebase.admin`;
    }))) return;

    // ── Step 7: Generate key + store in shared Firestore ─────────────────
    let serviceAccountJson;
    if (!(await step(7, 'Generate service account key', async () => {
      const { data: keyData } = await iam.projects.serviceAccounts.keys.create({
        name: `projects/${projectId}/serviceAccounts/${saEmail}`,
        requestBody: { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' },
      });
      serviceAccountJson = JSON.parse(Buffer.from(keyData.privateKeyData, 'base64').toString('utf8'));
      await db.collection('serviceAccounts').doc(username).set(serviceAccountJson);
      return `Key generated and stored in serviceAccounts/${username}`;
    }))) return;

    // ── Step 8: Create Firebase Auth user in new project ──────────────────
    const tempPassword = crypto.randomBytes(12).toString('base64') + '!1';
    if (!(await step(8, `Create Firebase Auth user for ${email}`, async () => {
      let userCreated = false;
      // CONFIGURATION_NOT_FOUND means Auth isn't provisioned yet — retry for up to 3 minutes
      for (let attempt = 1; attempt <= 20; attempt++) {
        try {
          await authClient.request({
            url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
            method: 'POST',
            headers: { 'x-goog-user-project': projectId },
            data: { localId: username, email, password: tempPassword, displayName: username, emailVerified: false, disabled: false },
          });
          userCreated = true;
          break;
        } catch (err) {
          const msg = err.message || '';
          if (msg.includes('EMAIL_EXISTS') || msg.includes('email-already-exists') || msg.includes('DUPLICATE_LOCAL_ID')) { userCreated = true; break; }
          if (attempt < 20) { await sleep(10000); }
          else throw err;
        }
      }
      return `Auth user created for ${email}`;
    }))) return;

    // ── Step 9: Seed Firestore access + deploy rules ───────────────────────
    if (!(await step(9, 'Seed Firestore access list & deploy rules', async () => {
      // Use personal authClient (project owner) to seed Firestore via REST API —
      // avoids waiting for service account IAM propagation
      const seedToken = (await authClient.getAccessToken()).token;
      const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
      const seedRes = await fetch(`${firestoreBase}/access/allowed_emails`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${seedToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            emails: { arrayValue: { values: [{ stringValue: email }] } },
          },
        }),
      });
      if (!seedRes.ok) {
        const seedErr = await seedRes.json();
        throw new Error(`Firestore seed failed: ${JSON.stringify(seedErr)}`);
      }

      // Deploy Firestore rules via Firebase Rules REST API
      const rulesContent = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /access/allowed_emails { allow read: if true; }
    match /{document=**} { allow read, write: if request.auth != null; }
  }
}`;
      const accessToken = (await authClient.getAccessToken()).token;
      const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
      });
      const ruleset = await rulesetRes.json();
      if (!ruleset.name) throw new Error(`Rules API error: ${JSON.stringify(ruleset)}`);
      await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: ruleset.name } }),
      });

      // Authorize realwise.com.br in Auth
      try {
        const { data: authConfig } = await authClient.request({
          url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
          method: 'GET', headers: { 'x-goog-user-project': projectId },
        });
        const existing = authConfig.authorizedDomains || [];
        if (!existing.includes('realwise.com.br')) {
          await authClient.request({
            url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
            method: 'PATCH',
            params: { updateMask: 'authorizedDomains' },
            headers: { 'x-goog-user-project': projectId },
            data: { authorizedDomains: [...existing, 'realwise.com.br'] },
          });
        }
      } catch (err) {
        console.warn('[onboardUser] Auth domain warning:', err.message);
      }

      return 'Firestore seeded, rules deployed, realwise.com.br authorized';
    }))) return;

    // ── Step 10: Write client config to Hosting ───────────────────────────
    if (!(await step(10, `Deploy clients/${username}.json to Hosting`, async () => {
      const clientConfig = {
        clientName: 'Realwise',
        firebase: sdkConfig,
        features: { investments: true, goals: false, b3Sync: true, whatsapp: false, salaryBreakdown: true },
      };
      const content = JSON.stringify(clientConfig, null, 2) + '\n';
      await deployFileToHosting(authClient, HOSTING_SITE_ID, `/clients/${username}.json`, content);
      return `clients/${username}.json deployed to Hosting`;
    }))) return;

    // ── Step 11: Grant owner to client + deploy-only access to operator ──
    if (!(await step(11, `Grant owner to ${email} + deploy access to operator`, async () => {
      const crm = google.cloudresourcemanager('v1');
      // Request v3 so GCP returns the full policy (Firebase/billing add conditional bindings).
      // Strip conditional bindings before writing back — GCP manages those and rejects them
      // if included in a setIamPolicy call alongside unconditional changes.
      const { data: policy } = await crm.projects.getIamPolicy({
        resource: projectId,
        requestBody: { options: { requestedPolicyVersion: 3 } },
      });
      // Strip conditional bindings (added by Firebase/billing) — they require v3 to read
      // but must not be included in a v1 setIamPolicy write. GCP rejects v3 policies
      // that have no remaining conditions, so downgrade to v1 after stripping.
      policy.version = 1;
      policy.bindings = (policy.bindings || []).filter((b) => !b.condition);

      // Grant roles/owner to the client so the project appears in their Firebase Console
      const clientMember = `user:${email.toLowerCase().trim()}`;
      const ownerBinding = policy.bindings.find((b) => b.role === 'roles/owner');
      if (ownerBinding) {
        if (!ownerBinding.members.includes(clientMember)) ownerBinding.members.push(clientMember);
      } else {
        policy.bindings.push({ role: 'roles/owner', members: [clientMember] });
      }

      // Grant deploy-only roles to operator (no Firestore/Storage/Auth data access)
      const operatorMember = `user:${OPERATOR_EMAIL}`;
      for (const role of OPERATOR_ROLES) {
        const binding = policy.bindings.find((b) => b.role === role);
        if (binding) {
          if (!binding.members.includes(operatorMember)) binding.members.push(operatorMember);
        } else {
          policy.bindings.push({ role, members: [operatorMember] });
        }
      }

      await crm.projects.setIamPolicy({ resource: projectId, requestBody: { policy } });
      return `Owner granted to ${email}; deploy-only roles granted to ${OPERATOR_EMAIL}`;
    }))) return;

    // ── Done ──────────────────────────────────────────────────────────────
    await db.collection('leads').doc(email).update({ state: 'active' });
    await runRef.update({ status: 'success', completedAt: admin.firestore.FieldValue.serverTimestamp() });

    // Send green-light email to the user
    try {
      const emailUser = emailUserSecret.value();
      const emailPass = emailPasswordSecret.value();
      const emailHost = emailHostSecret.value();
      const emailPort = emailPortSecret.value();
      if (emailUser && emailPass) {
        const transporter = nodemailer.createTransport({
          host: emailHost || 'smtp.umbler.com',
          port: parseInt(emailPort) || 587,
          secure: false,
          auth: { user: emailUser, pass: emailPass },
        });
        const loginUrl = `https://realwise.com.br/${username}/login`;
        await transporter.sendMail({
          from: `"Realwise" <${emailUser}>`,
          to: email,
          subject: 'Seu acesso ao Realwise está pronto! 🟢',
          html: accessGrantedTemplate(username, loginUrl),
        });
        await log(runId, 10, `Access email sent to ${email}`, 'success');
      }
    } catch (emailErr) {
      console.error('[onboardUser] Failed to send access email:', emailErr.message);
      await log(runId, 10, `Warning: could not send access email — ${emailErr.message}`, 'warn');
    }

    await log(runId, 11, `Onboarding complete for ${email}. Lead state → active.`, 'success');

    return { success: true };
  });
