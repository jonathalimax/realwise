import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { initSharedFirebase } from '../lib/sharedFirebase';
import LoginLoader from '../components/LoginLoader';
import { devMark } from '../lib/devMarker';
import { markLoginSession } from '../lib/auth/sessionAge';

export default function LoadingPage() {
  const navigate = useNavigate();
  const params = useParams();
  const ranRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      try {
        devMark('LoadingPage: start');
        const { auth: sharedAuth, functions: sharedFunctions } = await initSharedFirebase();
        if (!sharedAuth.currentUser) {
          devMark('LoadingPage: no shared session — back to /login');
          window.location.href = '/login';
          return;
        }
        const username = sharedAuth.currentUser.email.split('@')[0];

        if (import.meta.env.DEV) {
          devMark('LoadingPage: dev — set isReady');
          setIsReady(true);
          return;
        }

        const getCustomToken = httpsCallable(sharedFunctions, 'getCustomToken');
        const tokenResp = await getCustomToken({ username });
        const token = tokenResp.data.token;

        const configRes = await fetch(`/clients/${username}.json`);
        if (!configRes.ok) throw new Error('client_config_not_found');
        const userConfig = await configRes.json();

        const userAppName = username;
        const existingUserApp = getApps().find((a) => a.name === userAppName);
        const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
        const userAuth = getAuth(userApp);

        await signInWithCustomToken(userAuth, token);
        markLoginSession();
        localStorage.setItem('rw_last_client', username);

        devMark('LoadingPage: set isReady');
        setIsReady(true);
      } catch (err) {
        devMark('LoadingPage ERR: ' + (err?.message || 'unknown'));
        console.error('[LoadingPage] sign-in pipeline failed', err);
        sessionStorage.setItem('__rw_login_error', err?.message || 'unknown');
        window.location.href = '/login';
      }
    }

    run();
  }, [navigate, params]);

  return (
    <LoginLoader
      isReady={isReady}
      onFinished={() => {
        devMark('LoadingPage: navigate to dashboard');
        navigate('/dashboard', { replace: true });
      }}
    />
  );
}
