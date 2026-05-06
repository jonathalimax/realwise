// src/pages/SharedLogin.jsx
// Standalone login page served at /login.
// Does NOT rely on ClientConfigProvider or the per-client firebase.js bindings.

import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
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
        setInitDone(true);
      })
      .catch((err) => {
        console.error('[SharedLogin] init error', err);
        setError('Erro ao carregar configuração. Tente novamente.');
        setInitDone(true);
      });
  }, []);

  const handlePostSignIn = async (email, functions) => {
    devMark('SharedLogin: signed in as ' + email);
    if (!email) throw new Error('No email returned from Google');
    const username = email.split('@')[0];

    // In dev, the getCustomToken cloud function needs a real service account which
    // isn't available locally — redirect to the per-client login instead.
    if (import.meta.env.DEV) {
      const { getApps: _getApps } = await import('firebase/app');
      const { getAuth: _getAuth } = await import('firebase/auth');
      const sharedApp = _getApps().find(a => a.name === 'shared');
      const sharedAuth = sharedApp ? _getAuth(sharedApp) : null;
      console.log('[debug-auth] SharedLogin pre-redirect', {
        uid: sharedAuth?.currentUser?.uid,
        appName: sharedApp?.name,
        allApps: _getApps().map(a => a.name),
      });
      sessionStorage.setItem('__rw_dev_auth_uid', sharedAuth?.currentUser?.uid ?? '');
      sessionStorage.setItem('__rw_dev_auth_email', email ?? '');
      sessionStorage.setItem('__rw_dev_auth_at', String(Date.now()));
      devMark('SharedLogin: navigating to /' + username + '/dashboard');
      window.location.href = `/${username}/dashboard`;
      return;
    }

    let token;
    try {
      const getCustomToken = httpsCallable(functions, 'getCustomToken');
      const response = await getCustomToken({ username });
      token = response.data.token;
    } catch (fnErr) {
      if (fnErr.code === 'functions/not-found') {
        setError('Acesso não autorizado.');
        setTimeout(() => { window.location.href = '/'; }, 3000);
        return;
      }
      throw fnErr;
    }

    const configRes = await fetch(`/clients/${username}.json`);
    if (!configRes.ok) {
      setError('Configuração do usuário não encontrada.');
      setTimeout(() => { window.location.href = '/'; }, 3000);
      return;
    }
    const userConfig = await configRes.json();

    const userAppName = username;
    const existingUserApp = getApps().find((a) => a.name === userAppName);
    const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
    const userAuth = getAuth(userApp);

    console.log('[SharedLogin] signing in with custom token...');
    await signInWithCustomToken(userAuth, token);
    console.log('[SharedLogin] custom token sign-in succeeded, redirecting...');
    window.location.href = `/${username}/dashboard`;
  };

  const handleGoogleSignIn = async () => {
    if (!sharedRef.current) return;
    setError('');
    setLoading(true);

    try {
      const { auth, functions } = sharedRef.current;
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
      await handlePostSignIn(result.user.email, functions);
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
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
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
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
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

          <p className="text-center mt-8 text-sm text-gray-400">
            Acesso restrito a usuários cadastrados
          </p>
        </div>
      </div>
    </div>
  );
}
