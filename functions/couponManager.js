const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Check if user is admin
async function isAdmin(uid) {
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  return userDoc.data()?.role === 'admin' || userDoc.data()?.admin === true;
}

// Create or update a coupon
exports.setCoupon = functions.https.onCall(async (data, context) => {
  // Verify auth
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Verify admin
  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { code, discountPercent, description, expiresAt } = data;

  // Validate input
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Code must be a non-empty string');
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new functions.https.HttpsError('invalid-argument', 'Discount must be 0-100');
  }

  // Save coupon
  await admin.firestore().collection('config').doc('coupons').collection('codes').doc(code).set({
    code,
    discountPercent,
    description: description || '',
    active: false, // Default to inactive
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: expiresAt || null,
    usageCount: 0,
  }, { merge: true });

  return { success: true, code };
});

// Activate a coupon (deactivate others)
exports.activateCoupon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { code } = data;
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Code required');
  }

  const batch = admin.firestore().batch();

  // Deactivate all other coupons
  const allCoupons = await admin.firestore().collection('config').doc('coupons').collection('codes').get();
  allCoupons.docs.forEach((doc) => {
    if (doc.id !== code) {
      batch.update(doc.ref, { active: false });
    }
  });

  // Activate the selected coupon
  const couponRef = admin.firestore().collection('config').doc('coupons').collection('codes').doc(code);
  batch.update(couponRef, { active: true });

  // Update config with active coupon code
  const configRef = admin.firestore().collection('config').doc('pricing');
  batch.update(configRef, { activeCouponCode: code });

  await batch.commit();

  return { success: true, code };
});

// Deactivate all coupons
exports.deactivateAllCoupons = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const batch = admin.firestore().batch();

  // Deactivate all coupons
  const allCoupons = await admin.firestore().collection('config').doc('coupons').collection('codes').get();
  allCoupons.docs.forEach((doc) => {
    batch.update(doc.ref, { active: false });
  });

  // Clear active coupon from config
  const configRef = admin.firestore().collection('config').doc('pricing');
  batch.update(configRef, { activeCouponCode: null });

  await batch.commit();

  return { success: true };
});

// List all coupons
exports.listCoupons = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const snapshot = await admin.firestore().collection('config').doc('coupons').collection('codes').get();
  const coupons = snapshot.docs.map((doc) => doc.data());

  return { coupons };
});

// Delete a coupon
exports.deleteCoupon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!(await isAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { code } = data;
  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Code required');
  }

  await admin.firestore().collection('config').doc('coupons').collection('codes').doc(code).delete();

  return { success: true, code };
});
