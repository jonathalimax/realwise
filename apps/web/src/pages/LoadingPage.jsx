import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginLoader from '../components/LoginLoader';
import { buildLoginRedirectUrl } from '../lib/auth/loginClient';
import { markLoginSession } from '../lib/auth/sessionAge';
import { useAuth } from '../contexts/AuthContext';

export default function LoadingPage() {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'authenticated' && user?.clientId) {
      markLoginSession();
      localStorage.setItem('rw_last_client', user.clientId);
      setIsReady(true);
      return;
    }

    if (status === 'unauthenticated') {
      const storedClientId = localStorage.getItem('rw_last_client') || '';
      window.location.href = buildLoginRedirectUrl(window.location.pathname, storedClientId);
    }
  }, [status, user]);

  return (
    <LoginLoader
      isReady={isReady}
      onFinished={() => {
        navigate('/dashboard', { replace: true });
      }}
    />
  );
}
