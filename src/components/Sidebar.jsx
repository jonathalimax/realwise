import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import { useFeature, useClientConfig } from '../contexts/ClientConfigContext';
import {
  HomeIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  ChartPieIcon,
  BanknotesIcon,
  PresentationChartBarIcon,
} from '@heroicons/react/24/outline';

// Root routes that should show hamburger (not back button)
const ROOT_ROUTES = [
  '/dashboard', '/expenses', '/income', '/goals', '/bills', '/cards',
  '/transactions', '/settings', '/budget', '/help', '/notifications',
  '/planner', '/investments',
];

function NavItem({ path, icon, label, onClick }) {
  const Icon = icon;
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
          isActive
            ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25 font-black'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:text-violet-500'}`} />
          <span className="font-bold text-sm flex-1 uppercase">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function PlannerNavItem({ icon, label, isActive, onNavigate }) {
  const Icon = icon;
  return (
    <button
      onClick={onNavigate}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
        isActive
          ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:text-violet-500'}`} />
      <span className="font-bold text-sm flex-1 text-left uppercase">{label}</span>
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
      {children}
    </p>
  );
}

function getUserDisplayName(user) {
  if (!user) return null;
  if (user.displayName) return user.displayName;
  if (user.email) {
    const emailName = user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  return null;
}

function useCurrentUser() {
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

function SidebarContent({
  language, darkMode, toggleDarkMode, appName,
  hasInvestments, mobileClose, navigate, location,
  labels, onSignOut, user,
}) {
  const isPlannerTab = (tab) =>
    location.pathname === '/planner' && location.search.includes(`tab=${tab}`);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-10 h-10 object-cover" />
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {user?.displayName?.split(' ')[0] || appName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {/* Section 1 */}
        <SectionLabel>{language === 'pt' ? 'Visão geral' : 'Overview'}</SectionLabel>
        <div className="space-y-1">
          <NavItem path="/dashboard" icon={HomeIcon} label={labels.dashboard} onClick={mobileClose} />
          <NavItem path="/income" icon={ArrowTrendingUpIcon} label={labels.income} onClick={mobileClose} />
          <NavItem path="/expenses" icon={ArrowTrendingDownIcon} label={labels.expenses} onClick={mobileClose} />
          <PlannerNavItem
            icon={PresentationChartBarIcon}
            label={labels.rastreamento}
            isActive={isPlannerTab('rastreamento')}
            onNavigate={() => { navigate('/planner?tab=rastreamento'); mobileClose?.(); }}
          />
        </div>

        {/* Section 2 */}
        <SectionLabel>{language === 'pt' ? 'Planejamento' : 'Planning'}</SectionLabel>
        <div className="space-y-1">
          <PlannerNavItem
            icon={BanknotesIcon}
            label={labels.renda}
            isActive={isPlannerTab('renda')}
            onNavigate={() => { navigate('/planner?tab=renda'); mobileClose?.(); }}
          />
          <PlannerNavItem
            icon={ChartPieIcon}
            label={labels.alocacao}
            isActive={isPlannerTab('alocacao')}
            onNavigate={() => { navigate('/planner?tab=alocacao'); mobileClose?.(); }}
          />
          {hasInvestments && (
            <NavItem path="/investments" icon={BriefcaseIcon} label={labels.investments} onClick={mobileClose} />
          )}
        </div>

        {/* Section 3 */}
        <SectionLabel>{language === 'pt' ? 'Pagamentos' : 'Payments'}</SectionLabel>
        <div className="space-y-1">
          <NavItem path="/bills" icon={DocumentTextIcon} label={labels.bills} onClick={mobileClose} />
          <NavItem path="/cards" icon={CreditCardIcon} label={labels.cards} onClick={mobileClose} />
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <NavItem path="/settings" icon={Cog6ToothIcon} label={labels.settings} onClick={mobileClose} />

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSignOut}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-sm uppercase">{labels.logout}</span>
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl transition-all text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title={labels.darkMode}
          >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, darkMode, toggleDarkMode } = useSettings();
  const hasInvestments = useFeature('investments');
  const config = useClientConfig();
  const appName = config?.clientName ?? 'Moneywise';
  const [mobileOpen, setMobileOpen] = useState(false);

  const isNestedRoute = !ROOT_ROUTES.includes(location.pathname);

  const labels = {
    dashboard: language === 'pt' ? 'Painel' : 'Dashboard',
    expenses: language === 'pt' ? 'Saída' : 'Expenses',
    income: language === 'pt' ? 'Entrada' : 'Income',
    renda: 'Renda',
    alocacao: language === 'pt' ? 'Alocação' : 'Allocation',
    rastreamento: language === 'pt' ? 'Gastos por Categoria' : 'Spending by Category',
    investments: language === 'pt' ? 'Investimentos' : 'Investments',
    bills: language === 'pt' ? 'Contas' : 'Bills',
    cards: language === 'pt' ? 'Bancos' : 'Banks',
    settings: language === 'pt' ? 'Configurações' : 'Settings',
    logout: language === 'pt' ? 'Sair' : 'Logout',
    darkMode: language === 'pt' ? 'Modo escuro' : 'Dark mode',
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getParentRoute = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1) return '/' + pathParts[0];
    return '/dashboard';
  };

  const user = useCurrentUser();

  const sharedProps = {
    language, darkMode, toggleDarkMode, appName,
    hasInvestments, navigate, location, labels,
    onSignOut: handleSignOut, user,
  };

  return (
    <>
      {/* Mobile navigation button */}
      {isNestedRoute ? (
        <button
          onClick={() => navigate(getParentRoute())}
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
        <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setMobileOpen(false)} />
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
        <SidebarContent {...sharedProps} mobileClose={() => setMobileOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <SidebarContent {...sharedProps} mobileClose={null} />
      </aside>
    </>
  );
}
