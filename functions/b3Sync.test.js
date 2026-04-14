const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

// Initialize Firebase Admin with a stub so b3Sync.js can call admin.firestore() at module level
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

test('b3Sync exports runB3Sync function', () => {
  assert.doesNotThrow(() => {
    const mod = require('./b3Sync');
    assert.equal(typeof mod.runB3Sync, 'function');
  });
});
