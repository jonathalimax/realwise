async function logEvent() {}

export const analytics = {
  // Lifecycle
  userSignup: (userId) => logEvent(userId, 'user_signup'),
  onboardingComplete: (userId) => logEvent(userId, 'onboarding_complete'),
  firstImport: (userId, { bankId, transactionCount }) =>
    logEvent(userId, 'first_import', { bankId, transactionCount }),
  budgetCreated: (userId) => logEvent(userId, 'budget_created'),

  // Friction
  importError: (userId, { bankName, errorType }) =>
    logEvent(userId, 'import_error', { bankName, errorType }),
  aiQuotaWarning: (userId, { used, limit, threshold }) =>
    logEvent(userId, 'ai_quota_warning', { used, limit, threshold }),
  emptyStateVisited: (userId, { tab }) =>
    logEvent(userId, 'empty_state_visited', { tab }),
};
