const test = require('node:test');
const assert = require('node:assert/strict');

test('functions entrypoint loads without missing local modules', () => {
  assert.doesNotThrow(() => require('./index'));
});
