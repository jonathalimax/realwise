import { describe, it, expect } from 'vitest';
import { computeRemainingHold, pickMessageIndex } from './LoginLoader.timing';

describe('computeRemainingHold', () => {
  it('returns the full minimum when no time has elapsed', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 1000, minMs: 800 })).toBe(800);
  });

  it('returns zero when minimum has already elapsed', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 2000, minMs: 800 })).toBe(0);
  });

  it('returns the remaining ms when partway through', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 1300, minMs: 800 })).toBe(500);
  });

  it('never returns a negative number', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 5000, minMs: 800 })).toBe(0);
  });
});

describe('pickMessageIndex', () => {
  it('cycles through messages on a 2200ms interval', () => {
    expect(pickMessageIndex({ elapsedMs: 0, intervalMs: 2200, count: 4 })).toBe(0);
    expect(pickMessageIndex({ elapsedMs: 2199, intervalMs: 2200, count: 4 })).toBe(0);
    expect(pickMessageIndex({ elapsedMs: 2200, intervalMs: 2200, count: 4 })).toBe(1);
    expect(pickMessageIndex({ elapsedMs: 4400, intervalMs: 2200, count: 4 })).toBe(2);
    expect(pickMessageIndex({ elapsedMs: 6600, intervalMs: 2200, count: 4 })).toBe(3);
  });

  it('clamps to the last message after all have rotated once', () => {
    expect(pickMessageIndex({ elapsedMs: 8800, intervalMs: 2200, count: 4 })).toBe(3);
    expect(pickMessageIndex({ elapsedMs: 100000, intervalMs: 2200, count: 4 })).toBe(3);
  });
});
