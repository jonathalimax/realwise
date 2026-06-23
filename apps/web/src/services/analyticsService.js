import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

async function logEvent(userId, eventName, properties = {}) {
  if (!userId || !eventName) return;
  try {
    await addDoc(collection(db, 'events'), {
      userId,
      event: eventName,
      properties,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Analytics failures must not break product flows
  }
}

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
