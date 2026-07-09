import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api/auth';
import { resolveApiBaseUrl } from '../lib/api/client';
import { clearLoginSession, isLoginSessionExpired } from '../lib/auth/sessionAge';
import { resolveLoginClientId } from '../lib/auth/loginClient';

const API_BASE_URL = resolveApiBaseUrl();

function formatOauthReason(reason) {
  if (!reason) {
    return 'Falha na autenticacao. Tente novamente.';
  }

  return `Falha na autenticacao: ${reason}.`;
}

function getLoginErrorMessage(errorCode, reason) {
  switch (errorCode) {
    case 'oauth':
      return formatOauthReason(reason);
    case 'server':
      return 'Erro interno ao concluir o login.';
    default:
      return '';
  }
}

export default function SharedLogin() {
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [error, setError] = useState('');
  const authError = useMemo(
    () => {
      const params = new URLSearchParams(window.location.search);
      return {
        code: params.get('error') || '',
        reason: params.get('reason') || '',
      };
    },
    [],
  );

  useEffect(() => {
    async function bootstrap() {
      try {
        setError(getLoginErrorMessage(authError.code, authError.reason));

        const showLogin = sessionStorage.getItem('__rw_show_login');
        if (showLogin) {
          sessionStorage.removeItem('__rw_show_login');
          clearLoginSession();
          await authApi.logout().catch((err) => {
            if (err?.status !== 401) throw err;
          });
          setInitDone(true);
          return;
        }

        const session = await authApi.getSession().catch((err) => {
          if (err?.status === 401) return null;
          throw err;
        });

        if (session) {
          if (isLoginSessionExpired()) {
            clearLoginSession();
            await authApi.logout().catch((err) => {
              if (err?.status !== 401) throw err;
            });
            setInitDone(true);
            return;
          }

          window.location.href = `/${session.clientId}/dashboard`;
          return;
        }

        setInitDone(true);
      } catch (err) {
        console.error('[SharedLogin] bootstrap error', err);
        setError('Erro ao carregar configuracao. Tente novamente.');
        setInitDone(true);
      }
    }

    bootstrap();
  }, [authError]);

  const handleGoogleSignIn = () => {
    setError('');
    setLoading(true);
    const clientId = resolveLoginClientId({
      search: window.location.search,
      pathname: window.location.pathname,
      storedClientId: localStorage.getItem('rw_last_client') || '',
    });
    const authUrl = new URL(API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}/auth/google` : '/auth/google', window.location.origin);
    if (clientId) {
      authUrl.searchParams.set('clientId', clientId);
    }
    window.location.href = authUrl.toString();
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
          <span className="text-2xl font-bold text-white">Realwise</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Controle suas financas com clareza
          </h1>
          <p className="text-lg text-gray-400">
            Seu painel financeiro pessoal, seguro e isolado.
          </p>
        </div>

        <p className="text-sm text-gray-500">
          Realwise - feito com carinho por{' '}
          <a href="https://linkedin.com/in/jonathalimax" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Jonatha Lima</a>
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
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
            disabled={loading || !initDone}
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
            Acesso restrito a usuarios cadastrados
          </p>
        </div>
      </div>
    </div>
  );
}
