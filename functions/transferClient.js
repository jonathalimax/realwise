// functions/transferClient.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Client project map — add new clients here as you onboard them
const CLIENT_PROJECTS = {
  jonathalimax:         'moneywise-jonathalimax',
  carloscalzadillar:    'moneywise-carloscalzadillar',
  palomabandeiramatos5: 'moneywise-palomabandeiramatos5',
};

async function getAccessToken() {
  const credential = admin.credential.applicationDefault();
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function getIamPolicy(projectId, accessToken) {
  const res = await fetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' }
  );
  if (!res.ok) throw new Error(`getIamPolicy failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function setIamPolicy(projectId, policy, accessToken) {
  const res = await fetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    }
  );
  const body = await res.json();
  if (!res.ok) return { ok: false, body };
  return { ok: true, body };
}

exports.transferClient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const callerEmail = context.auth.token.email;
  const adminDoc = await db.collection('admins').doc(callerEmail).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not an admin');
  }

  const { clientId, clientEmail, billingAccount, removeSelf } = data;

  if (!clientId || !clientEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'clientId and clientEmail are required');
  }

  const projectId = CLIENT_PROJECTS[clientId];
  if (!projectId) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown clientId: ${clientId}`);
  }

  const consoleUrl = `https://console.cloud.google.com/iam-admin/iam?project=${projectId}`;
  const emailLower = clientEmail.toLowerCase().trim();

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Failed to get access token: ${err.message}`);
  }

  // Get current IAM policy
  let policy;
  try {
    policy = await getIamPolicy(projectId, accessToken);
  } catch (err) {
    throw new functions.https.HttpsError('internal', `Cannot read IAM policy: ${err.message}`);
  }

  // Link billing FIRST — upgrades Spark → Blaze, enabling CLI owner grants
  if (billingAccount) {
    const billingRes = await fetch(
      `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingAccountName: `billingAccounts/${billingAccount}` }),
      }
    );
    if (!billingRes.ok) {
      const billingErr = await billingRes.text();
      throw new functions.https.HttpsError('internal', `Billing link failed: ${billingErr}`);
    }
  }

  // Add owner binding
  const ownerBinding = policy.bindings?.find(b => b.role === 'roles/owner');
  const member = `user:${emailLower}`;
  if (ownerBinding) {
    if (!ownerBinding.members.includes(member)) ownerBinding.members.push(member);
  } else {
    policy.bindings = [...(policy.bindings || []), { role: 'roles/owner', members: [member] }];
  }

  // Optionally remove self
  if (removeSelf) {
    const selfMember = `user:${callerEmail}`;
    for (const binding of policy.bindings || []) {
      binding.members = binding.members.filter(m => m !== selfMember);
    }
    policy.bindings = policy.bindings.filter(b => b.members.length > 0);
  }

  const result = await setIamPolicy(projectId, policy, accessToken);

  if (!result.ok) {
    const errorBody = JSON.stringify(result.body);
    if (errorBody.includes('SOLO_MUST_INVITE_OWNERS')) {
      return {
        success: false,
        needsConsole: true,
        consoleUrl,
        message: 'This project requires owner invitation via the GCP Console (Spark plan restriction).',
      };
    }
    throw new functions.https.HttpsError('internal', `IAM update failed: ${errorBody}`);
  }

  return { success: true, projectId, clientEmail: emailLower, consoleUrl };
});
