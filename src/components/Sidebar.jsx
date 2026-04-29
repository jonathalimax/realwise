import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { logoutAndRedirect } from '../lib/auth/logout';
import { useSettings } from '../contexts/SettingsContext';
import { useFeature } from '../contexts/ClientConfigContext';
import {
  HomeIcon,
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  PuzzlePieceIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

function SidebarContent({ navigationGroups, language, onSignOut, mobileClose }) {
  const location = useLocation();
  const handleLinkClick = () => {
    if (mobileClose) mobileClose();
  };

  const isItemActive = (item) => {
    if (item.href.includes('?')) {
      const [path, search] = item.href.split('?');
      return location.pathname === path && location.search === '?' + search;
    }
    return location.pathname.replace(/\/$/, '') === item.href;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
          <span className="text-white text-xl">💰</span>
        </div>
        <div className="min-w-0">
          <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Moneywise</span>
          {auth.currentUser && (
            <p className="text-[10px] font-bold text-violet-500 truncate uppercase tracking-widest leading-none mt-0.5">
              {(() => {
                const user = auth.currentUser;
                if (!user) return null;
                const firstName = user.displayName?.split(' ')[0];
                return firstName ? `Olá, ${firstName}` : 'Olá novamente';
              })()}
            </p>
          )}
        </div>
        {mobileClose && (
          <button onClick={mobileClose} className="ml-auto p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 overflow-y-auto">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <hr className="my-2 border-gray-100 dark:border-gray-800" />
            )}
            <div className="space-y-1">
              {group.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={() => {
                    const active = isItemActive(item);
                    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all uppercase tracking-wide
                      ${active
                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`;
                  }}
                >
                  <item.icon className="w-5 h-5" />
                  {language === 'pt' ? item.namePt : item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all uppercase tracking-wide"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          {language === 'pt' ? 'Sair' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language } = useSettings();
  const navigate = useNavigate();
  const hasGoals = useFeature('goals');

  const navigationGroups = useMemo(() => [
    [
      { name: 'Dashboard', namePt: 'Painel', href: '/dashboard', icon: HomeIcon },
    ],
    [
      { name: 'Income', namePt: 'Entrada', href: '/income', icon: BanknotesIcon },
      { name: 'Expenses', namePt: 'Saída', href: '/expenses', icon: ArrowTrendingUpIcon },
      { name: 'Bills', namePt: 'Contas', href: '/bills', icon: BellIcon },
    ],
    [
      { name: 'Planning', namePt: 'Planejador', href: '/planner', icon: ChartBarIcon },
      { name: 'Expenses by Category', namePt: 'Despesas por Categoria', href: '/planner?tab=rastreamento', icon: TagIcon },
      ...(hasGoals ? [{ name: 'Goals', namePt: 'Metas', href: '/goals', icon: PuzzlePieceIcon }] : []),
    ],
    [
      { name: 'Import', namePt: 'Importar', href: '/import', icon: DocumentArrowDownIcon },
      { name: 'Help', namePt: 'Ajuda', href: '/help', icon: QuestionMarkCircleIcon },
      { name: 'Settings', namePt: 'Configurações', href: '/settings', icon: Cog6ToothIcon },
    ],
  ], [hasGoals]);

  useEffect(() => {
    const handleToggle = () => setMobileOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  const handleSignOut = async () => {
    await logoutAndRedirect();
  };

  const sharedProps = {
    navigationGroups,
    language,
    onSignOut: handleSignOut,
  };

  return (
    <>
      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 md:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <div
          className={`absolute inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent {...sharedProps} mobileClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
        <SidebarContent {...sharedProps} mobileClose={null} />
      </aside>
    </>
  );
}
