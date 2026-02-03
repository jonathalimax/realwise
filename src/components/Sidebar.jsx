import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  FlagIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { path: '/dashboard', icon: HomeIcon, labelKey: 'dashboard' },
  { path: '/planning', icon: ClipboardDocumentListIcon, labelKey: 'planning' },
  { path: '/expenses', icon: ArrowTrendingDownIcon, labelKey: 'expenses' },
  { path: '/income', icon: ArrowTrendingUpIcon, labelKey: 'income' },
  { divider: true },
  { path: '/goals', icon: FlagIcon, labelKey: 'goals' },
  { path: '/bills', icon: DocumentTextIcon, labelKey: 'bills' },
  { path: '/cards', icon: CreditCardIcon, labelKey: 'cards' },
  { path: '/investments', icon: ChartBarIcon, labelKey: 'investments' },
];

const bottomItems = [
  { path: '/help', icon: QuestionMarkCircleIcon, labelKey: 'help' },
  { path: '/settings', icon: Cog6ToothIcon, labelKey: 'settings' },
];

// Root routes that should show hamburger menu (not back button)
const ROOT_ROUTES = [
  '/dashboard',
  '/planning',
  '/expenses',
  '/income',
  '/goals',
  '/bills',
  '/cards',
  '/investments',
  '/transactions',
  '/settings',
  '/budget',
  '/help',
  '/whatsapp',
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, darkMode, toggleDarkMode } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if we're on a nested route (should show back button instead of hamburger)
  const isNestedRoute = !ROOT_ROUTES.includes(location.pathname);

  const labels = {
    dashboard: language === 'pt' ? 'Painel' : 'Dashboard',
    planning: language === 'pt' ? 'Planejamento' : 'Planning',
    expenses: language === 'pt' ? 'Saída' : 'Expenses',
    income: language === 'pt' ? 'Entrada' : 'Income',
    goals: language === 'pt' ? 'Metas' : 'Goals',
    bills: language === 'pt' ? 'Contas' : 'Bills',
    cards: language === 'pt' ? 'Cartões' : 'Cards',
    investments: language === 'pt' ? 'Investimentos' : 'Investments',
    help: language === 'pt' ? 'Ajuda' : 'Help',
    settings: language === 'pt' ? 'Configurações' : 'Settings',
    logout: language === 'pt' ? 'Sair' : 'Logout',
    darkMode: language === 'pt' ? 'Modo escuro' : 'Dark mode',
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const NavItem = ({ item, onClick }) => {
    if (item.divider) {
      return <div className="my-2 border-t border-gray-200 dark:border-gray-700" />;
    }

    return (
      <NavLink
        to={item.path}
        onClick={onClick}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
            isActive
              ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:text-violet-500'}`} />
            <span className="font-medium text-sm">{labels[item.labelKey]}</span>
          </>
        )}
      </NavLink>
    );
  };

  // Get user display name or email
  const getUserDisplayName = () => {
    const user = auth.currentUser;
    if (!user) return null;

    // Try display name first, then email username, then full email
    if (user.displayName) return user.displayName;
    if (user.email) {
      const emailName = user.email.split('@')[0];
      // Capitalize first letter
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return null;
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-lg font-bold text-gray-900 dark:text-white">Blim Wallet</span>
      </div>

      {/* User info */}
      {auth.currentUser && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/50 rounded-full flex items-center justify-center flex-shrink-0">
              {auth.currentUser.photoURL ? (
                <img
                  src={auth.currentUser.photoURL}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <span className="text-violet-600 dark:text-violet-300 font-semibold text-sm">
                  {getUserDisplayName()?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {getUserDisplayName()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {auth.currentUser.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => (
          <NavItem
            key={item.path || `divider-${index}`}
            item={item}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        {bottomItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            onClick={isMobile ? () => setMobileOpen(false) : undefined}
          />
        ))}

        {/* Logout and Dark mode row */}
        <div className="flex items-center gap-2 pt-1">
          {/* Logout */}
          <button
            onClick={handleSignOut}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">{labels.logout}</span>
          </button>

          {/* Dark mode toggle - icon only */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl transition-all text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={labels.darkMode}
          >
            {darkMode ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Get the parent route for back navigation
  const getParentRoute = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      // Return the first segment as the parent route (e.g., /investments/new -> /investments)
      return '/' + pathParts[0];
    }
    return '/dashboard';
  };

  const handleBackClick = () => {
    navigate(getParentRoute());
  };

  return (
    <>
      {/* Mobile navigation button - Shows back arrow on nested routes, hamburger on root routes */}
      {isNestedRoute ? (
        <button
          onClick={handleBackClick}
          className="md:hidden fixed top-[11px] left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
      ) : (
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-[11px] left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <XMarkIcon className="w-6 h-6 text-gray-500" />
        </button>
        <SidebarContent isMobile />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <SidebarContent />
      </aside>
    </>
  );
}
