export function resolveBudgetPreferences(
  settings,
  defaultRuleMapping,
  defaultRulePercentages,
) {
  return {
    categoryRuleMapping: {
      ...defaultRuleMapping,
      ...(settings?.categoryRuleMapping || {}),
    },
    rulePercentages: {
      ...defaultRulePercentages,
      ...(settings?.rulePercentages || {}),
    },
  };
}
