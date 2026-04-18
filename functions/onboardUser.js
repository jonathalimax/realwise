// functions/onboardUser.js
//
// Callable Cloud Function — runs the 9-step Firebase project provisioning
// for a new Moneywise user, streaming real-time log entries to Firestore.
//
// Caller must be authenticated and their email must exist in admins/{email}.
//
// data: { email: string, runId: string }
// Logs streamed to: onboardingRuns/{runId}/logs (subscribed by OnboardingRun.jsx)
// Run status written to: onboardingRuns/{runId}.status
//   queued → running → success | failed

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Append a log entry to onboardingRuns/{runId}/logs.
 * Called after every step by both this function and can be imported by
 * scripts/onboard-user.js if that script ever gains a Firestore write path.
 */
async function log(runId, step, message, level = 'info') {
  await db
    .collection('onboardingRuns')
    .doc(runId)
    .collection('logs')
    .add({
      step,
      message,
      level,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Delete all documents from a collection reference in batches.
 * Used to clean up old run logs before deleting the parent run doc.
 */
async function deleteCollection(ref, batchSize = 100) {
  const snap = await ref.limit(batchSize).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size === batchSize) await deleteCollection(ref, batchSize);
}

/**
 * Wrap a provisioning step:
 *   - logs "Starting: <description>"
 *   - runs fn()
 *   - on success: logs the returned message at level 'success'
 *   - on failure: logs error, marks run as failed, returns false
 *
 * Returns true on success, false on failure (caller should return early).
 */
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

// ─── Cloud Function ────────────────────────────────────────────────────────

exports.onboardUser = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // ── Auth guard ──────────────────────────────────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    }

    const { email, runId } = data;
    if (!email || !runId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'email and runId are required'
      );
    }

    // ── Step 0: Clean up old runs (> 60 days) ──────────────────────────────
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oldRuns = await db
      .collection('onboardingRuns')
      .where('startedAt', '<', cutoff)
      .get();
    for (const oldRun of oldRuns.docs) {
      await deleteCollection(oldRun.ref.collection('logs'));
      await oldRun.ref.delete();
    }

    // ── Mark run as running ─────────────────────────────────────────────────
    const runRef = db.collection('onboardingRuns').doc(runId);
    await runRef.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Sanitise username: lowercase, alphanumeric only (mirrors scripts/onboard-user.js)
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    // Shorthand for this run's step runner
    const step = (num, desc, fn) => runStep(runId, runRef, num, desc, fn);

    // ── Step 1: Create Firebase project via Firebase Management REST API ────
    if (!(await step(1, `Create Firebase project for ${username}`, async () => {
      // TODO: POST https://firebase.googleapis.com/v1beta1/projects
      // using a service account access token with `firebase.projects.create` permission.
      // Payload: { projectId: `limas-finance-${username}`, displayName: `Moneywise - ${username}` }
      // Poll the returned LRO until done === true before proceeding.
      return `Firebase project limas-finance-${username} creation queued (implement via Management API)`;
    }))) return;

    // ── Step 2: Enable required Firebase services ───────────────────────────
    if (!(await step(2, 'Enable Firebase services (Auth, Firestore, Storage)', async () => {
      // TODO: serviceusage.services.enable for:
      //   firestore.googleapis.com
      //   identitytoolkit.googleapis.com
      //   storage.googleapis.com
      return `Auth, Firestore, Storage enabled for ${username}`;
    }))) return;

    // ── Step 3: Create service account ─────────────────────────────────────
    if (!(await step(3, 'Create service account', async () => {
      // TODO: POST https://iam.googleapis.com/v1/projects/{projectId}/serviceAccounts
      //   { accountId: 'moneywise-admin', serviceAccount: { displayName: 'Moneywise Admin' } }
      return `Service account moneywise-admin created for ${username}`;
    }))) return;

    // ── Step 4: Grant IAM roles to service account ──────────────────────────
    if (!(await step(4, 'Grant IAM roles to service account', async () => {
      // TODO: cloudresourcemanager.projects.getIamPolicy / setIamPolicy
      //   Add roles/firebase.admin binding for the service account
      return `IAM roles/firebase.admin granted for ${username} service account`;
    }))) return;

    // ── Step 5: Generate service account key + store in serviceAccounts/{username}
    if (!(await step(5, 'Generate & store service account key', async () => {
      // TODO: POST https://iam.googleapis.com/v1/projects/{projectId}/serviceAccounts/{saEmail}/keys
      //   { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' }
      // Decode the base64 privateKeyData, parse JSON, store via:
      //   db.collection('serviceAccounts').doc(username).set(keyJson)
      return `Service account key stored in serviceAccounts/${username}`;
    }))) return;

    // ── Step 6: Write client config to Storage ──────────────────────────────
    if (!(await step(6, `Write client config to public/clients/${username}.json`, async () => {
      // TODO: Fetch SDK config via firebaseApi.projects.webApps.getConfig,
      //   build the clientConfig object (matching the shape in public/clients/_template.json),
      //   then write to Firebase Hosting via Storage or a build+deploy step.
      return `Client config written for ${username}`;
    }))) return;

    // ── Step 7: Seed Firestore with default categories + settings ───────────
    if (!(await step(7, 'Seed Firestore with defaults', async () => {
      // TODO: Use the service account key from step 5 to initialise a secondary
      //   Admin SDK app pointing at the new project, then write default:
      //   - settings/{userId} (currency, language, categories)
      //   - any seed transactions or planner state
      return `Default categories and settings seeded for ${username}`;
    }))) return;

    // ── Step 8: Create Firebase Auth user ───────────────────────────────────
    if (!(await step(8, `Create Firebase Auth user for ${email}`, async () => {
      // TODO: Use secondary Admin SDK app to:
      //   app.auth().createUser({ email, password: generatedTempPassword })
      // Optionally store the temp password securely or trigger a password-reset email.
      return `Auth user created for ${email} in project limas-finance-${username}`;
    }))) return;

    // ── Step 9: Deploy Firestore security rules ──────────────────────────────
    if (!(await step(9, 'Deploy Firestore security rules', async () => {
      // TODO: Use Firebase Management REST API to deploy firestore.rules:
      //   POST https://firebaserules.googleapis.com/v1/projects/{projectId}/rulesets
      //   then PATCH the named release to point at the new ruleset.
      return `Firestore rules deployed for ${username}`;
    }))) return;

    // ── All steps done ───────────────────────────────────────────────────────
    await db.collection('leads').doc(email).update({
      state: 'onboarding',
    });
    await runRef.update({
      status: 'success',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await log(
      runId,
      9,
      `Onboarding complete for ${email}. Lead state → onboarding.`,
      'success'
    );

    return { success: true };
  });
