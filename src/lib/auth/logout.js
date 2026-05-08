import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export async function logoutAndRedirect() {
  try { await signOut(auth); } finally {
    window.location.replace('/login');
  }
}
