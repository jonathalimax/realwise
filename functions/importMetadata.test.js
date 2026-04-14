const test = require('node:test');
const assert = require('node:assert/strict');
const { getPlannerGoalIdFromObjectMetadata } = require('./importMetadata');

test('returns plannerGoalId from storage metadata when present', () => {
  assert.equal(
    getPlannerGoalIdFromObjectMetadata({ metadata: { plannerGoalId: 'reserva-emergencia' } }),
    'reserva-emergencia'
  );
});

test('returns null when plannerGoalId metadata is missing', () => {
  assert.equal(getPlannerGoalIdFromObjectMetadata({ metadata: {} }), null);
  assert.equal(getPlannerGoalIdFromObjectMetadata({}), null);
});

test('trims whitespace from plannerGoalId metadata', () => {
  assert.equal(
    getPlannerGoalIdFromObjectMetadata({ metadata: { plannerGoalId: '  carteira-rf  ' } }),
    'carteira-rf'
  );
});
