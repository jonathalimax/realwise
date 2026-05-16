import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { logoutAndRedirect } from '../lib/auth/logout';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import {
  HomeIcon,
  BanknotesIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  BellIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

function SidebarContent({ navigationGroups, language, onSignOut, mobileClose, currentUser }) {
  const location = useLocation();
  const handleLinkClick = () => {
    if (mobileClose) mobileClose();
  };

  const isItemActive = (item) => {
    if (item.href.includes('?')) {
      const [path, search] = item.href.split('?');
      return location.pathname === path && location.search === '?' + search;
    }
    return location.pathname.replace(/\/$/, '') === item.href && location.search === '';
  };

  const navLinkClass = (item) => {
    const active = isItemActive(item);
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all uppercase tracking-wide
      ${active
        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
          <span className="text-white text-xl">💰</span>
        </div>
        <div className="min-w-0">
          <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Realwise</span>
          {currentUser && (
            <p className="text-[10px] font-bold text-violet-500 truncate uppercase tracking-widest leading-none mt-0.5">
              {currentUser.displayName?.split(' ')[0]
                ? `Olá, ${currentUser.displayName.split(' ')[0]}`
                : 'Olá novamente'}
            </p>
          )}
        </div>
        {mobileClose && (
          <button onClick={mobileClose} className="ml-auto p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Nav Links + Footer — all in one scrollable area so they scroll together on landscape */}
      <nav className="flex-1 px-4 overflow-y-auto pb-4">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={groupIndex > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 pb-1">
                {language === 'pt' ? group.labelPt : group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={() => navLinkClass(item)}
                >
                  <item.icon className="w-5 h-5" />
                  {language === 'pt' ? item.namePt : item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Footer items scroll with nav content */}
        <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
          <NavLink
            to="/settings"
            onClick={handleLinkClick}
            className={() => navLinkClass({ href: '/settings' })}
          >
            <Cog6ToothIcon className="w-5 h-5" />
            {language === 'pt' ? 'Configurações' : 'Settings'}
          </NavLink>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all uppercase tracking-wide"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {language === 'pt' ? 'Sair' : 'Sign out'}
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language } = useSettings();
  const navigate = useNavigate();
  const { currentUser } = useAccess();

  const navigationGroups = useMemo(() => [
    {
      label: 'Follow',
      labelPt: 'Acompanhar',
      items: [
        { name: 'Home', namePt: 'Início', href: '/dashboard', icon: HomeIcon },
        { name: 'Income', namePt: 'Entrada', href: '/income', icon: BanknotesIcon },
        { name: 'Expenses', namePt: 'Despesas', href: '/expenses', icon: ArrowTrendingUpIcon },
        { name: 'Bills', namePt: 'Contas', href: '/bills', icon: BellIcon }
      ],
    },
    {
      label: 'Plan',
      labelPt: 'Planejar',
      items: [
        { name: 'Planning', namePt: 'Planejamento', href: '/planning', icon: ChartPieIcon },
        { name: 'Investments', namePt: 'Investimentos', href: '/investments', icon: CalendarDaysIcon },
        { name: 'Banks', namePt: 'Bancos', href: '/banks', icon: BuildingLibraryIcon },
      ],
    },
  ], []);

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
    currentUser,
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
