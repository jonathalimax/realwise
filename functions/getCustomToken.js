// functions/getCustomToken.js
// Callable Cloud Function — mints a Firebase custom token for a user's own project.
//
// Caller must be authenticated against the shared Firebase project.
// The shared Firestore must contain a document at serviceAccounts/{username}
// with the full JSON key of a service account in the user's Firebase project.
//
// Returns: { token: string }
// Throws:
//   functions/unauthenticated  — caller not signed in
//   functions/not-found        — serviceAccounts/{username} does not exist
//   functions/internal         — any other failure

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Shared Firestore (already initialised by admin.initializeApp() in index.js)
const db = admin.firestore();

exports.getCustomToken = functions.https.onCall(async (data, context) => {
  // 1. Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const { username } = data;
  if (!username || typeof username !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'username is required.'
    );
  }

  // 2. Read service account from shared Firestore
  const saDoc = await db.collection('serviceAccounts').doc(username).get();
  if (!saDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      `No service account configured for user "${username}".`
    );
  }

  const serviceAccountData = saDoc.data();

  // 3. Initialise an ephemeral Admin SDK app for the user's project
  const appName = `user-${username}-${Date.now()}`;
  let userApp;
  try {
    userApp = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccountData) },
      appName
    );
  } catch (err) {
    console.error(`[getCustomToken] Failed to init app for ${username}:`, err);
    throw new functions.https.HttpsError('internal', 'Could not initialise user Firebase app.');
  }

  // 4. Mint the custom token — uid is the username (matches public/clients/{username}.json)
  let token;
  try {
    token = await userApp.auth().createCustomToken(username);
  } catch (err) {
    console.error(`[getCustomToken] createCustomToken failed for ${username}:`, err);
    throw new functions.https.HttpsError('internal', 'Failed to create custom token.');
  } finally {
    // 5. Always clean up the ephemeral app
    await userApp.delete().catch((e) =>
      console.warn(`[getCustomToken] Failed to delete ephemeral app ${appName}:`, e)
    );
  }

  return { token };
});
