import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LANGUAGES, DEFAULT_LANGUAGE, getTranslation } from '../locales';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { analytics } from '../services/analyticsService';

export default function Auth() {
  const config = useClientConfig();
  const appName = config?.clientName ?? '{appName}';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  // Translation function for auth page (before user is logged in)
  const t = (path, params = {}) => {
    const translations = LANGUAGES[language]?.translations || LANGUAGES[DEFAULT_LANGUAGE].translations;
    return getTranslation(translations, path, params);
  };

  // Check if email is in allowed list
  const checkEmailAllowed = async (email) => {
    try {
      const accessDoc = await getDoc(doc(db, 'access', 'allowed_emails'));
      if (!accessDoc.exists()) {
        // If no whitelist exists, allow all (for initial setup)
        console.log('No whitelist document - allowing access');
        return true;
      }
      const data = accessDoc.data();
      const allowedEmails = data.emails || [];
      // Check if empty list (allow all) or email is in list
      if (allowedEmails.length === 0) {
        console.log('Whitelist is empty - allowing access');
        return true;
      }
      // Handle both old format (array of strings) and new format (array of objects)
      const isAllowed = allowedEmails.some(e => {
        const emailStr = typeof e === 'string' ? e : e.email;
        return emailStr?.toLowerCase() === email.toLowerCase();
      });
      console.log(`Email ${email} allowed: ${isAllowed}`);
      return isAllowed;
    } catch (err) {
      console.error('Error checking access:', err);
      return false;
    }
  };

  // Clear any stale redirect state left by a previous incomplete signInWithRedirect.
  // getRedirectResult returns null immediately when there's no pending redirect.
  // If it hangs (stale state), the 4s timeout unsticks the UI.
  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 4000);

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return;
        const isAllowed = await checkEmailAllowed(result.user.email);
        if (!isAllowed) {
          await signOut(auth);
          setError(language === 'pt'
            ? 'Acesso não autorizado. Entre em contato com o administrador.'
            : 'Access not authorized. Please contact the administrator.');
        }
      })
      .catch((err) => {
        setError(getErrorMessage(err.code));
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isAllowed = await checkEmailAllowed(result.user.email);
      if (!isAllowed) {
        await signOut(auth);
        setError(language === 'pt'
          ? 'Acesso não autorizado. Entre em contato com o administrador.'
          : 'Access not authorized. Please contact the administrator.');
      } else if (result.additionalUserInfo?.isNewUser) {
        analytics.userSignup(result.user.uid);
      }
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code) => {
    const errorMap = {
      'auth/popup-closed-by-user': t('auth.errors.popupClosed'),
      'auth/cancelled-popup-request': t('auth.errors.popupClosed'),
      'auth/account-exists-with-different-credential': language === 'pt'
        ? 'Uma conta já existe com este email usando outro método de login.'
        : 'An account already exists with this email using a different sign-in method.',
    };
    return errorMap[code] || t('auth.errors.generic');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">{appName}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            {t('auth.tagline')}
          </h1>
          <p className="text-lg text-gray-400">
            {t('auth.description')}
          </p>

          <div className="flex items-center gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold text-white">100%</p>
              <p className="text-sm text-gray-400">{t('auth.freeToUse')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{t('auth.secureStorage')}</p>
              <p className="text-sm text-gray-400">{t('auth.cloudStorage')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{t('auth.simple')}</p>
              <p className="text-sm text-gray-400">{t('auth.easyToUse')}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {t('auth.madeWithCare')}
        </p>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          {/* Language Selector & Mobile Logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{appName}</span>
            </div>
            <div className="hidden lg:block" />
            <button
              onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-lg">{language === 'pt' ? '🇧🇷' : '🇺🇸'}</span>
              <span>{language === 'pt' ? 'PT' : 'EN'}</span>
            </button>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('auth.welcomeBack')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {language === 'pt'
                ? 'Entre com sua conta Google para continuar'
                : 'Sign in with your Google account to continue'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl
                font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {language === 'pt' ? 'Continuar com Google' : 'Continue with Google'}
            </button>
          </div>

          <p className="text-center mt-8 text-sm text-gray-400">
            {language === 'pt'
              ? 'Acesso restrito a usuários autorizados'
              : 'Access restricted to authorized users'}
          </p>
        </div>
      </div>
    </div>
  );
}
