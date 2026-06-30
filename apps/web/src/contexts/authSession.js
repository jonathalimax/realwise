import { authApi } from '../lib/api/auth';
import { clearLoginSession, isLoginSessionExpired, markLoginSession } from '../lib/auth/sessionAge';

const UNAUTHENTICATED_STATE = {
  status: 'unauthenticated',
  user: null,
};

export function normalizeAuthenticatedUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    uid: user.uid ?? user.sub ?? null,
    displayName: user.displayName ?? user.name ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
  };
}

export async function bootstrapAuthSession({
  authClient = authApi,
  isExpired = isLoginSessionExpired,
  clearSessionAge = clearLoginSession,
  markSessionAge = markLoginSession,
} = {}) {
  try {
    const user = await authClient.getSession();
    if (!user) {
      return UNAUTHENTICATED_STATE;
    }

    if (isExpired()) {
      try {
        await authClient.logout();
      } finally {
        clearSessionAge();
      }
      return UNAUTHENTICATED_STATE;
    }

    markSessionAge();
    return {
      status: 'authenticated',
      user: normalizeAuthenticatedUser(user),
    };
  } catch (error) {
    if (error?.status === 401) {
      return UNAUTHENTICATED_STATE;
    }

    throw error;
  }
}

export async function logoutAuthSession({
  authClient = authApi,
  clearSessionAge = clearLoginSession,
} = {}) {
  try {
    await authClient.logout();
  } catch (error) {
    if (error?.status !== 401) {
      throw error;
    }
  }

  clearSessionAge();
  return UNAUTHENTICATED_STATE;
}
