// functions/updatePricingConfig.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.updatePricingConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const callerEmail = context.auth.token.email;
  const adminDoc = await db.collection('admins').doc(callerEmail).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Not an admin');
  }

  const { originalCents, totalCents, installments, active, campaignLabel } = data;

  if (!Number.isInteger(originalCents) || originalCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'originalCents must be a positive integer.');
  }
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents must be a positive integer.');
  }
  if (!Number.isInteger(installments) || installments <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'installments must be a positive integer.');
  }
  if (totalCents > originalCents) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents não pode ser maior que originalCents.');
  }
  const installmentCents = Math.round(totalCents / installments);
  if (installmentCents * installments !== totalCents) {
    throw new functions.https.HttpsError('invalid-argument', 'totalCents deve ser divisível por installments sem resto.');
  }

  await db.collection('config').doc('pricing').set({
    originalCents,
    totalCents,
    installments,
    active: !!active,
    campaignLabel: campaignLabel || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: callerEmail,
  }, { merge: true });

  return { success: true };
});
