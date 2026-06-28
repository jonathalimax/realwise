import { authApi } from '../api/auth';
import { clearLoginSession } from './sessionAge';

export async function logoutAndRedirect() {
  try {
    clearLoginSession();
    await authApi.logout().catch((error) => {
      if (error?.status !== 401) throw error;
    });
  } finally {
    window.location.replace('/login');
  }
}
