function getPlannerGoalIdFromObjectMetadata(object = {}) {
  const value = object?.metadata?.plannerGoalId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = {
  getPlannerGoalIdFromObjectMetadata,
};
