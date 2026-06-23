export function computeRemainingHold({ startedAt, now, minMs }) {
  const elapsed = now - startedAt;
  return Math.max(0, minMs - elapsed);
}

export function pickMessageIndex({ elapsedMs, intervalMs, count }) {
  const raw = Math.floor(elapsedMs / intervalMs);
  return Math.min(raw, count - 1);
}
