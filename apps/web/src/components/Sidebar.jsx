import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PlanBadge } from './billing/PlanBadge';
import { logoutAndRedirect } from '../lib/auth/logout';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useFeature } from '../contexts/ClientConfigContext';
import {
  HomeIcon,
  BanknotesIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  BellIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

function getUserInitials(name) {
  if (!name) return '';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function SidebarContent({ navigationGroups, language, onSignOut, mobileClose, currentUser }) {
  const location = useLocation();
  const userInitials = getUserInitials(currentUser?.displayName);
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
        {currentUser?.profileImageUrl ? (
          <img
            src={currentUser.profileImageUrl}
            alt={currentUser.displayName ?? 'User profile'}
            className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-violet-600/20"
            referrerPolicy="no-referrer"
          />
        ) : userInitials ? (
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
            <span className="text-white text-sm font-black">{userInitials}</span>
          </div>
        ) : (
          <img
            src="/logo.png"
            alt="Realwise"
            className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-violet-600/20"
          />
        )}
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

      <PlanBadge onNavigate={handleLinkClick} />

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
          {/* Only admins see this; the API still checks the role on every admin request. */}
          {currentUser?.role === 'admin' && (
            <a href="/admin" className={navLinkClass({ href: '/admin' })}>
              <ShieldCheckIcon className="w-5 h-5" />
              Admin
            </a>
          )}
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
  const { language } = useSettings();
  const { currentUser } = useAccess();
  const hasInvestments = useFeature('investments');

  const navigationGroups = useMemo(() => [
    {
      label: 'Follow',
      labelPt: 'Acompanhar',
      items: [
        { name: 'Home', namePt: 'Início', href: '/dashboard', icon: HomeIcon },
        { name: 'Activity', namePt: 'Movimentos', href: '/transactions', icon: ArrowTrendingUpIcon },
        { name: 'Elio', namePt: 'Elio', href: '/chat', icon: SparklesIcon },
        { name: 'Bills', namePt: 'Contas', href: '/bills', icon: BellIcon }
      ],
    },
    {
      label: 'Plan',
      labelPt: 'Planejar',
      items: [
        { name: 'Budget', namePt: 'Orçamento', href: '/planning', icon: ChartPieIcon },
        ...(hasInvestments ? [{ name: 'Investments', namePt: 'Investimentos', href: '/investments', icon: CalendarDaysIcon }] : []),
        { name: 'Banks', namePt: 'Bancos', href: '/banks', icon: BuildingLibraryIcon },
      ],
    },
  ], [hasInvestments]);

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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
        <SidebarContent {...sharedProps} mobileClose={null} />
      </aside>
    </>
  );
}
