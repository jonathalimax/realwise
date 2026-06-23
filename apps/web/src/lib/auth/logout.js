import { getApps } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { initSharedFirebase } from '../sharedFirebase';
import { clearLoginSession } from './sessionAge';

export async function logoutAndRedirect() {
  try {
    const shared = await initSharedFirebase().catch(() => null);
    const auths = getApps().map((app) => getAuth(app));
    if (shared?.auth && !auths.includes(shared.auth)) {
      auths.push(shared.auth);
    }
    sessionStorage.removeItem('__rw_dev_auth_at');
    clearLoginSession();
    await Promise.allSettled(auths.map((auth) => signOut(auth)));
  } finally {
    window.location.replace('/login');
  }
}
