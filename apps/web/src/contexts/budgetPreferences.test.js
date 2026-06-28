import { describe, expect, it } from 'vitest';
import { resolveBudgetPreferences } from './budgetPreferences';
import { DEFAULT_RULE_MAPPING, DEFAULT_RULE_PERCENTAGES } from './BudgetContext';

describe('resolveBudgetPreferences', () => {
  it('merges API settings with budget defaults', () => {
    expect(resolveBudgetPreferences({
      categoryRuleMapping: { Housing: 'needs', Travel: 'wants' },
      rulePercentages: { needs: 60, wants: 20, savings: 20 },
    }, DEFAULT_RULE_MAPPING, DEFAULT_RULE_PERCENTAGES)).toEqual({
      categoryRuleMapping: expect.objectContaining({
        Housing: 'needs',
        Travel: 'wants',
      }),
      rulePercentages: {
        needs: 60,
        wants: 20,
        savings: 20,
      },
    });
  });

  it('falls back to defaults when API settings are missing', () => {
    expect(resolveBudgetPreferences(null, DEFAULT_RULE_MAPPING, DEFAULT_RULE_PERCENTAGES)).toEqual({
      categoryRuleMapping: expect.any(Object),
      rulePercentages: {
        needs: 50,
        wants: 30,
        savings: 20,
      },
    });
  });
});
