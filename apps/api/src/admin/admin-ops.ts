import * as admin from 'firebase-admin';
import type { firestore as FirestoreTypes } from 'firebase-admin';
import { google } from 'googleapis';
import { createHash, randomBytes } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

type AuthClientLike = {
  getAccessToken(): Promise<string | { token?: string | null } | null>;
  request<T = unknown>(config: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    data?: unknown;
  }): Promise<{ data: T }>;
};

type IamBinding = {
  role?: string;
  members?: string[];
};

type IamPolicy = {
  bindings?: IamBinding[];
};

type HostingReleaseList = {
  releases?: Array<{ version?: { name?: string } }>;
};

type HostingFilesList = {
  files?: Array<{ path?: string; hash?: string }>;
  nextPageToken?: string;
};

type HostingVersion = {
  name?: string;
  config?: Record<string, unknown>;
};

type PopulateFilesResponse = {
  uploadRequiredHashes?: string[];
  uploadUrl?: string;
};

type FirebaseWebAppOperation = {
  appId?: string;
};

type FirebaseWebAppConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function toErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function getErrorStatus(err: unknown) {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function normalizeAccessToken(token: string | { token?: string | null } | null) {
  if (typeof token === 'string') return token;
  return token?.token ?? null;
}

let firebaseAppInitialized = false;

function getDb() {
  if (!firebaseAppInitialized) {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firebaseAppInitialized = true;
  }
  return admin.firestore();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function log(runId: string, step: number, message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  await getDb().collection('onboardingRuns').doc(runId).collection('logs').add({
    step,
    message,
    level,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function runStep(
  runId: string,
  runRef: Pick<FirestoreTypes.DocumentReference, 'update'>,
  stepNum: number,
  description: string,
  fn: () => Promise<string | void>,
) {
  await log(runId, stepNum, `Starting: ${description}`);
  try {
    const result = await fn();
    await log(runId, stepNum, result || `Done: ${description}`, 'success');
    return true;
  } catch (err: unknown) {
    const fullMsg = `FAILED: ${description} — ${toErrorMessage(err)}`;
    await log(runId, stepNum, fullMsg, 'error');
    await runRef.update({ status: 'failed', error: fullMsg });
    return false;
  }
}

async function getAuthClient(): Promise<AuthClientLike> {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  });
  return (await auth.getClient()) as AuthClientLike;
}

async function deployFileToHosting(authClient: AuthClientLike, siteId: string, filePath: string, content: string) {
  const base = 'https://firebasehosting.googleapis.com/v1beta1';
  const token = normalizeAccessToken(await authClient.getAccessToken());
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const releasesRes = await fetch(`${base}/sites/${siteId}/releases?pageSize=1`, { headers });
  const releasesData = (await releasesRes.json()) as HostingReleaseList;
  const currentVersionName = releasesData.releases?.[0]?.version?.name;

  const existingFiles: Record<string, string> = {};
  let previousConfig = {};
  if (currentVersionName) {
    let pageToken;
    do {
      const url = `${base}/${currentVersionName}/files?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const filesRes = await fetch(url, { headers });
      const filesData = (await filesRes.json()) as HostingFilesList;
      for (const f of filesData.files || []) {
        if (f.path && f.hash) {
          existingFiles[f.path] = f.hash;
        }
      }
      pageToken = filesData.nextPageToken;
    } while (pageToken);

    const versionRes = await fetch(`${base}/${currentVersionName}`, { headers });
    const versionData = (await versionRes.json()) as HostingVersion;
    if (versionData.config) previousConfig = versionData.config;
  }

  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const compressed = await promisify(gzip)(buf);
  const hash = createHash('sha256').update(compressed).digest('hex');

  const versionRes = await fetch(`${base}/sites/${siteId}/versions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ config: previousConfig }),
  });
  const versionData = (await versionRes.json()) as HostingVersion;
  const versionName = versionData.name;
  const fileHashes = { ...existingFiles, [filePath]: hash };
  const populateRes = await fetch(`${base}/${versionName}:populateFiles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ files: fileHashes }),
  });
  const populateData = (await populateRes.json()) as PopulateFilesResponse;
  const uploadRequiredHashes = new Set(populateData.uploadRequiredHashes || []);

  if (uploadRequiredHashes.has(hash)) {
    const uploadToken = normalizeAccessToken(await authClient.getAccessToken());
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

  await fetch(`${base}/${versionName}?updateMask=status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'FINALIZED' }),
  });

  await fetch(`${base}/sites/${siteId}/releases?versionName=${versionName}`, {
    method: 'POST',
    headers,
    body: '{}',
  });
}

const BILLING_ACCOUNT_ID = process.env.BILLING_ACCOUNT_ID || '01F570-F17CDE-9379F7';
const HOSTING_SITE_ID = process.env.FIREBASE_HOSTING_SITE_ID || 'mymoneywise';
const OPERATOR_EMAIL = process.env.ADMIN_OPERATOR_EMAIL || 'jonathalimax@gmail.com';
const OPERATOR_ROLES = [
  'roles/cloudfunctions.developer',
  'roles/firebasehosting.admin',
  'roles/cloudbuild.builds.editor',
  'roles/artifactregistry.writer',
  'roles/iam.serviceAccountUser',
];

export async function startOnboardingRun(
  dto: { email: string; runId: string },
  opts: { sendAccessEmail?: (name: string, loginUrl: string) => Promise<void> } = {},
) {
  const db = getDb();
  const { email, runId } = dto;
  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const projectId = `realwise-${username}`;
  const runRef = db.collection('onboardingRuns').doc(runId);

  void (async () => {
    try {
      await runRef.set({ email, status: 'queued', createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const oldRuns = await db.collection('onboardingRuns').where('startedAt', '<', cutoff).get();
      for (const oldRun of oldRuns.docs) {
        const logs = await oldRun.ref.collection('logs').get();
        for (const logDoc of logs.docs) {
          await logDoc.ref.delete();
        }
        await oldRun.ref.delete();
      }

      await runRef.set({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const authClient = await getAuthClient();
      google.options({ auth: authClient as never });

      const resourceManager = google.cloudresourcemanager('v1');
      const serviceUsage = google.serviceusage('v1');
      const iam = google.iam('v1');
      const firebaseApi = google.firebase('v1beta1');
      const firestoreApi = google.firestore('v1');

      if (!(await runStep(runId, runRef, 1, `Create GCP project ${projectId}`, async () => {
        try {
          await resourceManager.projects.create({ requestBody: { projectId, name: `Realwise ${username}` } });
        } catch (err: unknown) {
          if (!toErrorMessage(err).includes('already exists')) throw err;
        }
        for (let i = 0; i < 20; i++) {
          const { data: p } = await resourceManager.projects.get({ projectId });
          if (p.lifecycleState === 'ACTIVE') break;
          await sleep(3000);
        }
        return `GCP project ${projectId} is ACTIVE`;
      }))) return;

      if (!(await runStep(runId, runRef, 2, 'Link billing account', async () => {
        const billing = google.cloudbilling('v1');
        await billing.projects.updateBillingInfo({
          name: `projects/${projectId}`,
          requestBody: { billingAccountName: `billingAccounts/${BILLING_ACCOUNT_ID}` },
        }).catch((err: unknown) => {
          if (!toErrorMessage(err).includes('Precondition')) throw err;
        });
        return 'Billing account linked';
      }))) return;

      if (!(await runStep(runId, runRef, 3, 'Add Firebase to project', async () => {
        try {
          const op = await firebaseApi.projects.addFirebase({ project: `projects/${projectId}`, requestBody: {} });
          let done = false;
          while (!done) {
            await sleep(4000);
            const { data: opData } = await firebaseApi.operations.get({ name: op.data.name });
            done = opData.done;
          }
        } catch (err: unknown) {
          if (!toErrorMessage(err).includes('already')) throw err;
        }
        return 'Firebase added to project';
      }))) return;

      if (!(await runStep(runId, runRef, 4, 'Enable APIs & initialize Firebase services', async () => {
        for (const api of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
          let lastErr: unknown = null;
          for (let attempt = 0; attempt < 6; attempt++) {
            try {
              await serviceUsage.services.enable({ name: `projects/${projectId}/services/${api}`, requestBody: {} });
              lastErr = null;
              break;
            } catch (err: unknown) {
              if (toErrorMessage(err).includes('billing')) {
                lastErr = err;
                await sleep(20000);
              } else {
                throw err;
              }
            }
          }
          if (lastErr) throw lastErr;
          await sleep(1000);
        }
        await sleep(5000);
        try {
          await authClient.request({
            url: `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,
            method: 'POST',
            headers: { 'x-goog-user-project': projectId },
            data: {},
          });
        } catch (err: unknown) {
          if (!(getErrorStatus(err) === 409 || toErrorMessage(err).includes('already'))) {
            console.warn('[onboarding] Auth init warning:', toErrorMessage(err));
          }
        }
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
        } catch (err: unknown) {
          if (!toErrorMessage(err).includes('already exists')) throw err;
        }
        return 'APIs enabled, Firestore created, Auth initialized';
      }))) return;

      let sdkConfig: FirebaseWebAppConfig;
      if (!(await runStep(runId, runRef, 5, 'Create Firebase web app & fetch SDK config', async () => {
        const fetchSdkConfig = async (appId: string): Promise<FirebaseWebAppConfig> => {
          const { data } = await firebaseApi.projects.webApps.getConfig({
            name: `projects/${projectId}/webApps/${appId}/config`,
          });
          return {
            apiKey: data.apiKey ?? undefined,
            authDomain: data.authDomain ?? undefined,
            projectId: data.projectId ?? undefined,
            storageBucket: data.storageBucket ?? undefined,
            messagingSenderId: data.messagingSenderId ?? undefined,
            appId: data.appId ?? undefined,
          };
        };
        try {
          const createOp = await firebaseApi.projects.webApps.create({ parent: `projects/${projectId}`, requestBody: { displayName: `Realwise ${username}` } });
          let appData: FirebaseWebAppOperation | null = null;
          let done = false;
          while (!done) {
            await sleep(3000);
            const { data: opData } = await firebaseApi.operations.get({ name: createOp.data.name });
            done = opData.done;
            if (done) appData = (opData.response as FirebaseWebAppOperation | undefined) ?? null;
          }
          if (!appData?.appId) throw new Error('Missing Firebase web app id');
          sdkConfig = await fetchSdkConfig(appData.appId);
        } catch (err: unknown) {
          if (toErrorMessage(err).includes('already')) {
            const { data } = await firebaseApi.projects.webApps.list({ parent: `projects/${projectId}` });
            const firstApp = data.apps?.[0]?.appId;
            if (!firstApp) throw new Error('No Firebase web apps found');
            sdkConfig = await fetchSdkConfig(firstApp);
          } else throw err;
        }
        return `Web app created, SDK config fetched (appId: ${sdkConfig.appId})`;
      }))) return;

      const saId = 'realwise-admin';
      const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;
      if (!(await runStep(runId, runRef, 6, 'Create service account & grant IAM roles', async () => {
        try {
          await iam.projects.serviceAccounts.create({
            name: `projects/${projectId}`,
            requestBody: { accountId: saId, serviceAccount: { displayName: 'Realwise Admin' } },
          });
        } catch (err: unknown) {
          if (!toErrorMessage(err).includes('already exists')) throw err;
        }
        await sleep(10000);
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

      let serviceAccountJson: Record<string, unknown>;
      if (!(await runStep(runId, runRef, 7, 'Generate service account key', async () => {
        const { data: keyData } = await iam.projects.serviceAccounts.keys.create({
          name: `projects/${projectId}/serviceAccounts/${saEmail}`,
          requestBody: { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' },
        });
        serviceAccountJson = JSON.parse(Buffer.from(keyData.privateKeyData, 'base64').toString('utf8'));
        await db.collection('serviceAccounts').doc(username).set(serviceAccountJson);
        return `Key generated and stored in serviceAccounts/${username}`;
      }))) return;

      const tempPassword = randomBytes(12).toString('base64') + '!1';
      if (!(await runStep(runId, runRef, 8, `Create Firebase Auth user for ${email}`, async () => {
        for (let attempt = 1; attempt <= 20; attempt++) {
          try {
            await authClient.request({
              url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
              method: 'POST',
              headers: { 'x-goog-user-project': projectId },
              data: { localId: username, email, password: tempPassword, displayName: username, emailVerified: false, disabled: false },
            });
            break;
          } catch (err: unknown) {
            const msg = toErrorMessage(err);
            if (msg.includes('EMAIL_EXISTS') || msg.includes('email-already-exists') || msg.includes('DUPLICATE_LOCAL_ID')) break;
            if (attempt < 20) await sleep(10000);
            else throw err;
          }
        }
        return `Auth user created for ${email}`;
      }))) return;

      if (!(await runStep(runId, runRef, 9, 'Seed Firestore access list & deploy rules', async () => {
        const seedToken = normalizeAccessToken(await authClient.getAccessToken());
        const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
        const seedRes = await fetch(`${firestoreBase}/access/allowed_emails`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${seedToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { emails: { arrayValue: { values: [{ stringValue: email }] } } },
          }),
        });
        if (!seedRes.ok) throw new Error(`Firestore seed failed: ${await seedRes.text()}`);

        const rulesContent = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /access/allowed_emails { allow read: if true; }
    match /{document=**} { allow read, write: if request.auth != null; }
  }
}`;
        const accessToken = normalizeAccessToken(await authClient.getAccessToken());
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

        try {
          const { data: authConfig } = await authClient.request({
            url: `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
            method: 'GET',
            headers: { 'x-goog-user-project': projectId },
          }) as { data: { authorizedDomains?: string[] } };
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
        } catch (err: unknown) {
          console.warn('[onboarding] Auth domain warning:', toErrorMessage(err));
        }

        return 'Firestore seeded, rules deployed, realwise.com.br authorized';
      }))) return;

      if (!(await runStep(runId, runRef, 10, `Deploy clients/${username}.json to Hosting`, async () => {
        const clientConfig = {
          clientName: 'Realwise',
          firebase: sdkConfig,
          features: { investments: true, goals: false, b3Sync: true, whatsapp: false, salaryBreakdown: true },
        };
        const content = JSON.stringify(clientConfig, null, 2) + '\n';
        await deployFileToHosting(authClient, HOSTING_SITE_ID, `/clients/${username}.json`, content);
        return `clients/${username}.json deployed to Hosting`;
      }))) return;

      if (!(await runStep(runId, runRef, 11, `Grant Firebase admin to ${email} + deploy access to operator`, async () => {
        const crm = google.cloudresourcemanager('v1');
        const { data: policy } = await crm.projects.getIamPolicy({ resource: projectId, requestBody: {} });

        const clientMember = `user:${email.toLowerCase().trim()}`;
        const clientRoles = ['roles/firebase.admin', 'roles/viewer'];
        for (const role of clientRoles) {
          const binding = policy.bindings.find((b) => b.role === role);
          if (binding) {
            if (!binding.members.includes(clientMember)) binding.members.push(clientMember);
          } else {
            policy.bindings.push({ role, members: [clientMember] });
          }
        }

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
        return `Firebase admin granted to ${email}; deploy-only roles granted to ${OPERATOR_EMAIL}`;
      }))) return;

      await db.collection('leads').doc(email).update({ state: 'active' });
      await runRef.update({ status: 'success', completedAt: admin.firestore.FieldValue.serverTimestamp() });

      const loginUrl = `https://realwise.com.br/${username}/login`;
      if (opts.sendAccessEmail) {
        await opts.sendAccessEmail(username, loginUrl);
      }
      return { success: true, projectId, username, loginUrl };
    } catch (err: unknown) {
      const message = toErrorMessage(err);
      await runRef.update({ status: 'failed', error: message });
      throw err;
    }
  })();

  return { started: true, runId };
}

export async function getOnboardingRun(runId: string) {
  const snap = await getDb().collection('onboardingRuns').doc(runId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function listOnboardingRunLogs(runId: string) {
  const snap = await getDb()
    .collection('onboardingRuns')
    .doc(runId)
    .collection('logs')
    .orderBy('ts', 'asc')
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function transferClient(dto: {
  clientId: string;
  clientEmail: string;
  billingAccount?: string | null;
  removeSelf?: boolean;
}, callerEmail: string) {
  const CLIENT_PROJECTS: Record<string, string> = {
    jonathalimax: 'realwise-jonathalimax',
    carloscalzadillar: 'realwise-carloscalzadillar',
    palomabandeiramatos5: 'realwise-palomabandeiramatos5',
  };
  const projectId = CLIENT_PROJECTS[dto.clientId];
  if (!projectId) throw new Error(`Unknown clientId: ${dto.clientId}`);
  const consoleUrl = `https://console.cloud.google.com/iam-admin/iam?project=${projectId}`;
  const emailLower = dto.clientEmail.toLowerCase().trim();
  const authClient = await getAuthClient();

  const policyRes = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${normalizeAccessToken(await authClient.getAccessToken())}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!policyRes.ok) throw new Error(`getIamPolicy failed: ${await policyRes.text()}`);
  const policy = (await policyRes.json()) as IamPolicy;

  if (dto.billingAccount) {
    const billingRes = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${normalizeAccessToken(await authClient.getAccessToken())}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingAccountName: `billingAccounts/${dto.billingAccount}` }),
    });
    if (!billingRes.ok) {
      const billingErr = await billingRes.text();
      throw new Error(`Billing link failed: ${billingErr}`);
    }
  }

  const ownerBinding = policy.bindings?.find((b) => b.role === 'roles/owner');
  const member = `user:${emailLower}`;
  if (ownerBinding) {
    if (!ownerBinding.members.includes(member)) ownerBinding.members.push(member);
  } else {
    policy.bindings = [...(policy.bindings || []), { role: 'roles/owner', members: [member] }];
  }

  if (dto.removeSelf) {
    const selfMember = `user:${callerEmail}`;
    for (const binding of policy.bindings || []) {
      binding.members = binding.members.filter((m: string) => m !== selfMember);
    }
    policy.bindings = policy.bindings.filter((b) => (b.members?.length ?? 0) > 0);
  }

  const setRes = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${normalizeAccessToken(await authClient.getAccessToken())}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
  const setBody = await setRes.json();
  if (!setRes.ok) {
    const errorBody = JSON.stringify(setBody);
    if (errorBody.includes('SOLO_MUST_INVITE_OWNERS')) {
      return { success: false, needsConsole: true, consoleUrl, message: 'This project requires owner invitation via the GCP Console (Spark plan restriction).' };
    }
    throw new Error(`IAM update failed: ${errorBody}`);
  }

  return { success: true, projectId, clientEmail: emailLower, consoleUrl };
}
