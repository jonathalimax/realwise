import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  ChatBubbleBottomCenterTextIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
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
  { path: '/whatsapp', icon: ChatBubbleBottomCenterTextIcon, labelKey: 'whatsapp' },
  { path: '/help', icon: QuestionMarkCircleIcon, labelKey: 'help' },
  { path: '/settings', icon: Cog6ToothIcon, labelKey: 'settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { t, language, darkMode, toggleDarkMode } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  const labels = {
    dashboard: language === 'pt' ? 'Painel' : 'Dashboard',
    planning: language === 'pt' ? 'Planejamento' : 'Planning',
    expenses: language === 'pt' ? 'Saída' : 'Expenses',
    income: language === 'pt' ? 'Entrada' : 'Income',
    goals: language === 'pt' ? 'Metas' : 'Goals',
    bills: language === 'pt' ? 'Contas' : 'Bills',
    cards: language === 'pt' ? 'Cartões' : 'Cards',
    investments: language === 'pt' ? 'Investimentos' : 'Investments',
    whatsapp: 'WhatsApp',
    help: language === 'pt' ? 'Ajuda' : 'Help',
    settings: language === 'pt' ? 'Configurações' : 'Settings',
    logout: language === 'pt' ? 'Sair' : 'Logout',
    darkMode: language === 'pt' ? 'Modo escuro' : 'Dark mode',
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/selling');
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

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {darkMode ? (
            <SunIcon className="w-5 h-5 flex-shrink-0" />
          ) : (
            <MoonIcon className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium text-sm">{labels.darkMode}</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{labels.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </button>

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
