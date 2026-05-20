// functions/updateLeadState.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const VALID_STATES = ['pending', 'not_paid', 'paid', 'active', 'cancelled', 'refunded'];

exports.updateLeadState = functions.https.onCall(async (data, context) => {
  // Auth + admin check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const callerEmail = context.auth.token.email;
  const adminDoc = await db.collection('admins').doc(callerEmail).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not an admin');
  }

  const { email, state } = data;
  if (!email || !state) {
    throw new functions.https.HttpsError('invalid-argument', 'email and state are required');
  }
  if (!VALID_STATES.includes(state)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid state: ${state}. Must be one of: ${VALID_STATES.join(', ')}`);
  }

  await db.collection('leads').doc(email).update({
    state,
    stateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    stateUpdatedBy: callerEmail,
  });

  return { success: true, email, state };
});
