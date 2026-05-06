const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const storage = admin.storage();

const MAX_BYTES = 2 * 1024 * 1024;
const DAILY_RATE_LIMIT = 5;

exports.submitImportIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }
  const userEmail = context.auth.token.email || 'unknown';
  const userId = context.auth.uid;

  const {
    fileName, fileMime, fileBase64,
    bankType, parserUsed, detectedHeaders,
    errorMessage, userNote, userName, clientId
  } = data || {};

  if (!fileName || !fileBase64 || !bankType || !clientId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  const buf = Buffer.from(fileBase64, 'base64');
  if (buf.length > MAX_BYTES) {
    throw new functions.https.HttpsError('invalid-argument', 'File too large (max 2MB)');
  }

  const today = new Date().toISOString().split('T')[0];
  const rlRef = db.collection('importIssueRateLimits').doc(`${userId}_${today}`);
  const rlSnap = await rlRef.get();
  const used = rlSnap.exists ? (rlSnap.data().count || 0) : 0;
  if (used >= DAILY_RATE_LIMIT) {
    throw new functions.https.HttpsError('resource-exhausted', 'Daily report limit reached');
  }

  const issueRef = db.collection('importIssues').doc();
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const storagePath = `importIssues/${issueRef.id}/${safeName}`;

  await storage.bucket().file(storagePath).save(buf, {
    contentType: fileMime || 'application/octet-stream',
    resumable: false,
  });

  await issueRef.set({
    ts: admin.firestore.FieldValue.serverTimestamp(),
    clientId,
    userEmail,
    userName: userName || '',
    bankType,
    parserUsed: parserUsed || 'unknown',
    detectedHeaders: Array.isArray(detectedHeaders) ? detectedHeaders.slice(0, 50) : [],
    fileName: safeName,
    fileMime: fileMime || 'application/octet-stream',
    fileSizeBytes: buf.length,
    storagePath,
    errorMessage: errorMessage || null,
    userNote: userNote || null,
    status: 'open',
    internalNotes: [],
  });

  await rlRef.set({ count: used + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  return { ok: true, issueId: issueRef.id };
});
