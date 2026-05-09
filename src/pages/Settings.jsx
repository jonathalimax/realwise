import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { auth } from '../firebase';
import { deleteUser, onAuthStateChanged } from 'firebase/auth';
import { logoutAndRedirect } from '../lib/auth/logout';
import PageHeader from '../components/PageHeader';

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    language,
    billReminders,
    updateBillReminders,
    darkMode,
    toggleDarkMode,
    t
  } = useSettings();

  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setCurrentUser);
  }, []);

  const handleSignOut = async () => {
    await logoutAndRedirect();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={t('settings.title')} showMonth={false} />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        <div className="space-y-6">
            {/* Profile */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-16 h-16 object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-violet-600 dark:text-violet-300">
                    {currentUser?.displayName?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{currentUser?.displayName || currentUser?.email?.split('@')[0] || '—'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser?.email}</p>
              </div>
            </div>

            {/* Appearance & Notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {/* Dark mode */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {darkMode
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    }
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {language === 'pt' ? 'Modo escuro' : 'Dark mode'}
                  </span>
                </div>
                <button
                  role="switch"
                  aria-checked={darkMode}
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${darkMode ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Bill reminders */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <svg className={`w-5 h-5 ${billReminders ? 'text-violet-500' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {language === 'pt' ? 'Lembretes de contas' : 'Bill reminders'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {language === 'pt' ? 'Email diário às 9h (Brasília)' : 'Daily email at 9 AM (Brazil)'}
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={billReminders}
                  onClick={() => updateBillReminders(!billReminders)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${billReminders ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${billReminders ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Navigation Cards */}
            <div className="space-y-3">
              {/* Categories Card */}
              <button
                onClick={() => navigate('/settings/categories')}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                      {t('settings.categories')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {language === 'pt' ? 'Gerenciar categorias de entrada e saída' : 'Manage income and expense categories'}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Banks Card */}
              <button
                onClick={() => navigate('/settings/banks')}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                      {language === 'pt' ? 'Bancos' : 'Banks'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {language === 'pt' ? 'Configurar contas bancárias' : 'Configure bank accounts'}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Logout + Delete */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:items-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {language === 'pt' ? 'Sair da conta' : 'Sign out'}
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-rose-200 dark:border-rose-800 overflow-hidden">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {language === 'pt' ? 'Excluir conta' : 'Delete account'}
                  </button>
                ) : (
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {language === 'pt' ? 'Tem certeza? Esta ação é irreversível.' : 'Are you sure? This action is irreversible.'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'pt' ? 'Digite DELETE para confirmar:' : 'Type DELETE to confirm:'}
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-3 py-2 text-sm border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                        className="flex-1 py-2 text-sm font-medium rounded-lg bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-700 transition-colors"
                      >
                        {deletingAccount
                          ? (language === 'pt' ? 'Excluindo...' : 'Deleting...')
                          : (language === 'pt' ? 'Confirmar exclusão' : 'Confirm delete')}
                      </button>
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                        className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {language === 'pt' ? 'Cancelar' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
