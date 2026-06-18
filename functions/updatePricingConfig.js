const functions = require('firebase-functions');
const admin = require('firebase-admin');

async function isAdmin(uid) {
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  return userDoc.data()?.role === 'admin' || userDoc.data()?.admin === true;
}

exports.updatePricingConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { basePriceCents, installments } = data;

  // Validate
  if (!Number.isInteger(basePriceCents) || basePriceCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'basePriceCents must be positive integer');
  }
  if (!Number.isInteger(installments) || installments <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'installments must be positive integer');
  }

  // Save to Firestore
  await admin.firestore().collection('config').doc('pricing').set({
    basePriceCents,
    installments,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.token.email,
  }, { merge: true });

  return { success: true, basePriceCents, installments };
});
