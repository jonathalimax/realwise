export function requireOwnerId(ownerId) {
  if (!ownerId) {
    throw new Error('Authenticated owner is required');
  }

  return ownerId;
}
