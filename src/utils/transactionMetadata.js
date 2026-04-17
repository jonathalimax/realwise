export function buildUpdatedMetadata(prevMeta, finalCategory, originalCategory) {
  if (!prevMeta) {
    return { catSource: 'manual', catConfidence: 1.0, isCorrected: false, originalCategory: finalCategory };
  }
  const categoryChanged = finalCategory !== originalCategory;
  const wasAutoCategorized = prevMeta.catSource && prevMeta.catSource !== 'manual';
  return {
    ...prevMeta,
    // Once corrected, stays corrected regardless of further edits
    isCorrected: prevMeta.isCorrected || (categoryChanged && wasAutoCategorized),
  };
}
