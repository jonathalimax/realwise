import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  getFirstIncompleteIndex,
  isOnboardingComplete,
  countCompletedSteps,
} from './onboardingSteps.js';

const FULL_PROFILE = { hasAccount: true, hasRenda: true, hasTransaction: true };
const EMPTY_PROFILE = { hasAccount: false, hasRenda: false, hasTransaction: false };

describe('ONBOARDING_STEPS', () => {
  it('has exactly 3 steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
  });

  it('each step has id, title, subtitle, and isComplete function', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.id).toBe('string');
      expect(typeof step.title).toBe('string');
      expect(typeof step.subtitle).toBe('string');
      expect(typeof step.isComplete).toBe('function');
    }
  });

  it('step ids are unique', () => {
    const ids = ONBOARDING_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('step.isComplete', () => {
  const [renda, account, transaction] = ONBOARDING_STEPS;

  it('renda step: complete when hasRenda is true', () => {
    expect(renda.isComplete({ hasRenda: true })).toBe(true);
    expect(renda.isComplete({ hasRenda: false })).toBe(false);
  });

  it('account step: complete when hasAccount is true', () => {
    expect(account.isComplete({ hasAccount: true })).toBe(true);
    expect(account.isComplete({ hasAccount: false })).toBe(false);
  });

  it('transaction step: complete when hasTransaction is true', () => {
    expect(transaction.isComplete({ hasTransaction: true })).toBe(true);
    expect(transaction.isComplete({ hasTransaction: false })).toBe(false);
  });

  it('each step tolerates null/undefined profile gracefully', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.isComplete(null)).toBe(false);
      expect(step.isComplete(undefined)).toBe(false);
    }
  });
});

describe('getFirstIncompleteIndex', () => {
  it('returns 0 when no steps are complete', () => {
    expect(getFirstIncompleteIndex(EMPTY_PROFILE)).toBe(0);
  });

  it('returns 1 when only renda is complete', () => {
    expect(getFirstIncompleteIndex({ hasAccount: false, hasRenda: true, hasTransaction: false })).toBe(1);
  });

  it('returns 2 when renda and account are complete', () => {
    expect(getFirstIncompleteIndex({ hasAccount: true, hasRenda: true, hasTransaction: false })).toBe(2);
  });

  it('returns -1 when all steps are complete', () => {
    expect(getFirstIncompleteIndex(FULL_PROFILE)).toBe(-1);
  });
});

describe('isOnboardingComplete', () => {
  it('returns false when no steps are complete', () => {
    expect(isOnboardingComplete(EMPTY_PROFILE)).toBe(false);
  });

  it('returns false when only some steps are complete', () => {
    expect(isOnboardingComplete({ hasAccount: true, hasRenda: true, hasTransaction: false })).toBe(false);
  });

  it('returns true when all steps are complete', () => {
    expect(isOnboardingComplete(FULL_PROFILE)).toBe(true);
  });
});

describe('countCompletedSteps', () => {
  it('returns 0 when nothing is done', () => {
    expect(countCompletedSteps(EMPTY_PROFILE)).toBe(0);
  });

  it('counts partial completion correctly', () => {
    expect(countCompletedSteps({ hasAccount: false, hasRenda: true, hasTransaction: false })).toBe(1);
    expect(countCompletedSteps({ hasAccount: true, hasRenda: true, hasTransaction: false })).toBe(2);
  });

  it('returns total step count when all complete', () => {
    expect(countCompletedSteps(FULL_PROFILE)).toBe(ONBOARDING_STEPS.length);
  });
});
