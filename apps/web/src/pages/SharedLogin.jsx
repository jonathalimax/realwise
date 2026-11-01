import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { FileText, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react';
import { authApi } from '../lib/api/auth';
import { resolveApiBaseUrl } from '../lib/api/client';
import { clearLoginSession, isLoginSessionExpired } from '../lib/auth/sessionAge';
import { resolveLoginClientId } from '../lib/auth/loginClient';
import { mailtoUrl, useSupportConfig, whatsappUrl } from '../components/contact/useSupportConfig';

// The animated demo is only worth its bytes on wide screens, so it loads on demand.
const ChatDemo = lazy(() => import('../../landing_page/components/landing/ChatDemo'));

const API_BASE_URL = resolveApiBaseUrl();

const PERKS = [
  { icon: FileText, text: 'Mande o extrato ou a fatura do seu banco' },
  { icon: Sparkles, text: 'O Elio categoriza tudo e aprende com você' },
  { icon: MessageCircle, text: 'Pergunte o que quiser sobre os seus gastos' },
];

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

  // The login is always dark, even for users on light mode: keep the page behind it (iOS overscroll) and the
  // browser chrome dark too, then hand both back when leaving.
  useEffect(() => {
    const html = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevBg = html.style.backgroundColor;
    const prevColor = meta?.getAttribute('content') ?? null;
    html.style.backgroundColor = '#020617';
    meta?.setAttribute('content', '#020617');
    return () => {
      html.style.backgroundColor = prevBg;
      if (meta && prevColor !== null) meta.setAttribute('content', prevColor);
    };
  }, []);

  const support = useSupportConfig();
  const accountDeleted = useMemo(() => new URLSearchParams(window.location.search).has('deleted'), []);

  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Soft violet glows behind everything */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-[var(--rw-brand)]/30 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/25 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Realwise" className="h-10 w-10 rounded-xl object-contain" />
          <span className="text-2xl font-bold tracking-tight">Realwise</span>
        </div>
        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 lg:order-1">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Suas finanças, organizadas{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">por conversa</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-400 sm:text-lg">
            Seu assistente de IA lê seus extratos, separa os gastos e responde suas dúvidas. Sem planilhas.
          </p>

          <ul className="mt-7 space-y-3.5">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300 sm:text-base">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-brand)]/15 text-violet-300 ring-1 ring-violet-400/20">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          {wide && (
            <div className="mt-10 hidden lg:block">
              <Suspense fallback={<div className="mx-auto h-[470px] w-full max-w-[320px]" />}>
                <ChatDemo />
              </Suspense>
            </div>
          )}
        </div>

        <div className="order-1 w-full lg:order-2">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Seu assistente financeiro com IA
            </span>

            <h2 className="mt-5 text-2xl font-bold">Bem-vindo ao Realwise</h2>
            <p className="mt-2 text-slate-400">Entre com sua conta Google para começar ou voltar ao seu painel.</p>

            {accountDeleted && !error && (
              <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-300">Sua conta foi excluída e seus dados foram apagados.</p>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading || !initDone}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3.5 font-semibold text-slate-900 shadow-lg shadow-violet-900/20
                transition hover:bg-slate-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continuar com Google
            </button>

            <p className="mt-5 text-center text-sm text-slate-400">
              Primeira vez por aqui? Entre com o Google e criamos a sua conta na hora.
            </p>

            <p className="mt-4 text-center text-xs text-slate-500">
              Ao continuar, você concorda com os{' '}
              <a href="/termos" className="underline hover:text-slate-300">Termos de Uso</a> e a{' '}
              <a href="/privacidade" className="underline hover:text-slate-300">Política de Privacidade</a>.
            </p>

            <p className="mt-6 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Ambiente seguro e protegido.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Precisa de ajuda?{' '}
            <a href={whatsappUrl(support.whatsapp)} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 underline-offset-2 hover:underline">WhatsApp</a>
            {' · '}
            <a href={mailtoUrl(support.email)} className="font-semibold text-slate-300 underline-offset-2 hover:underline">{support.email}</a>
          </p>

          <p className="mt-3 text-center text-xs text-slate-600">
            Realwise, feito com carinho por{' '}
            <a href="https://linkedin.com/in/jonathalimax" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">Jonatha Lima</a>
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
