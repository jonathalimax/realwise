// src/pages/SharedLogin.jsx
// Standalone login page served at /login.
// Does NOT rely on ClientConfigProvider or the per-client firebase.js bindings.

import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { initSharedFirebase } from '../lib/sharedFirebase';
import { devMark } from '../lib/devMarker';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
  </div>
);

export default function SharedLogin() {
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [error, setError] = useState('');
  const sharedRef = useRef(null); // { auth, functions }

  useEffect(() => {
    initSharedFirebase()
      .then((shared) => {
        sharedRef.current = shared;
        // Auto-redirect: already signed in → go straight through the loader
        if (shared.auth.currentUser) {
          const username = shared.auth.currentUser.email.split('@')[0];
          window.location.href = `/${username}/loading`;
          return;
        }
        // Surface any error left by LoadingPage on a previous failed attempt
        const prior = sessionStorage.getItem('__rw_login_error');
        if (prior) {
          sessionStorage.removeItem('__rw_login_error');
          if (prior === 'client_config_not_found') {
            setError('Configuração do usuário não encontrada.');
          } else {
            setError('Falha na autenticação. Tente novamente.');
          }
        }
        setInitDone(true);
      })
      .catch((err) => {
        console.error('[SharedLogin] init error', err);
        setError('Erro ao carregar configuração. Tente novamente.');
        setInitDone(true);
      });
  }, []);

  const handlePostSignIn = async (email) => {
    devMark('SharedLogin: signed in as ' + email);
    if (!email) throw new Error('No email returned from Google');
    const username = email.split('@')[0];
    // Navigate immediately to the per-client loading route. The LoadingPage
    // owns the rest of the pipeline (config fetch, getCustomToken,
    // signInWithCustomToken). This is what makes the login button stop spinning fast.
    window.location.href = `/${username}/loading`;
  };

  const handleDevEmulatorSignIn = async () => {
    if (!sharedRef.current) return;
    setError('');
    setLoading(true);
    try {
      const { auth } = sharedRef.current;
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
      // Clear any stale auth state — the emulator may have been restarted
      // since IndexedDB was last written, leaving us with a token for a UID
      // that no longer exists ("Internal state invariant broken").
      await signOut(auth).catch(() => {});
      const DEV_EMAIL = 'jonathalimax@gmail.com';
      const DEV_PASSWORD = 'devpassword';
      const projectId = auth.app.options.projectId;

      // Helper: forcefully delete the user from the Auth Emulator REST API.
      // The emulator accepts "Bearer owner" as an admin auth shortcut.
      const purgeDevUser = async () => {
        try {
          const lookupRes = await fetch(
            `http://localhost:9099/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
              body: JSON.stringify({ email: [DEV_EMAIL] }),
            }
          );
          const lookup = await lookupRes.json();
          const localId = lookup?.users?.[0]?.localId;
          if (!localId) return;
          await fetch(
            `http://localhost:9099/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
              body: JSON.stringify({ localId }),
            }
          );
        } catch (purgeErr) {
          console.warn('[SharedLogin] purge dev user failed', purgeErr);
        }
      };

      let result;
      try {
        result = await signInWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
      } catch (e) {
        const code = e?.code;
        const recoverableNotFound = code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials';
        const wrongPassword = code === 'auth/wrong-password';
        if (recoverableNotFound) {
          result = await createUserWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
        } else if (wrongPassword) {
          // Stale dev user from a previous run with a different password — purge & recreate.
          await purgeDevUser();
          result = await createUserWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
        } else {
          throw e;
        }
      }
      await handlePostSignIn(result.user.email);
    } catch (err) {
      console.error('[SharedLogin] dev sign-in error', err);
      setError('Falha no sign-in dev: ' + (err?.message || 'unknown'));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!sharedRef.current) return;
    setError('');
    setLoading(true);

    try {
      const { auth } = sharedRef.current;
      const apiKey = auth.app.options.apiKey;
      const authDomain = auth.app.options.authDomain;
      const protocol = authDomain.includes('localhost') ? 'http' : 'https';
      const popupUrl = `${protocol}://${authDomain}/__/auth/handler?apiKey=${apiKey}`;

      const popup = window.open(popupUrl, 'firebase-auth-popup', 'width=500,height=600,left=400,top=100');

      const idToken = await new Promise((resolve, reject) => {
        const onMessage = (event) => {
          if (event.data?.type === 'lf-google-auth') {
            window.removeEventListener('message', onMessage);
            clearInterval(closedCheck);
            resolve(event.data.idToken);
          }
        };
        window.addEventListener('message', onMessage);

        const closedCheck = setInterval(() => {
          if (popup.closed) {
            clearInterval(closedCheck);
            window.removeEventListener('message', onMessage);
            reject(new Error('Popup closed'));
          }
        }, 500);
      });

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await handlePostSignIn(result.user.email);
    } catch (err) {
      console.error('[SharedLogin] auth error', err);
      setError('Falha na autenticação. Tente novamente.');
      setLoading(false);
    }
  };

  if (!initDone) return <PageLoader />;

  return (
    <div className="min-h-screen flex">
      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
          <span className="text-2xl font-bold text-white">Realwise</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Controle suas finanças com clareza
          </h1>
          <p className="text-lg text-gray-400">
            Seu painel financeiro pessoal, seguro e isolado.
          </p>
        </div>

        <p className="text-sm text-gray-500">Realwise — feito com cuidado</p>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo.jpg" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Realwise</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bem-vindo</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Entre com sua conta Google para acessar seu painel
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl
              font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700
              active:bg-gray-100 dark:active:bg-gray-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continuar com Google
          </button>

          {import.meta.env.DEV && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">DEV</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <button
                onClick={handleDevEmulatorSignIn}
                disabled={loading}
                className="w-full py-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30
                  rounded-xl font-medium text-amber-700 dark:text-amber-300
                  hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando...' : 'Entrar como jonathalimax (DEV emulator)'}
              </button>
            </>
          )}

          <p className="text-center mt-8 text-sm text-gray-400">
            Acesso restrito a usuários cadastrados
          </p>
        </div>
      </div>
    </div>
  );
}
