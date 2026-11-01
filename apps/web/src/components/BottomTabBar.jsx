import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const TABS = [
  { to: '/dashboard', pt: 'Início', en: 'Home', icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/transactions', pt: 'Movimentos', en: 'Activity', icon: <path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" /> },
  { to: '/chat', pt: 'Elio', en: 'Elio', center: true },
  { to: '/planning', pt: 'Orçamento', en: 'Budget', icon: (<><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>) },
  { to: '/bills', pt: 'Contas', en: 'Bills', icon: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" /></>) },
];

// Routes that belong to each tab, so a nested screen keeps its tab highlighted.
const BELONGS = {
  '/dashboard': ['/dashboard'],
  '/transactions': ['/transactions', '/income', '/expenses'],
  '/planning': ['/planning', '/budget', '/settings/categories'],
  '/bills': ['/bills', '/cards', '/banks'],
};

/** Mobile bottom navigation. Replaces the hamburger menu; the desktop sidebar keeps the same places. */
export default function BottomTabBar() {
  const { language } = useSettings();
  const { pathname } = useLocation();
  const pt = language === 'pt';
  // The chat has its own composer at the bottom, and form screens need the whole height.
  if (/\/(chat|new|edit|withdraw|payment)(\/|$)/.test(pathname)) return null;
  const isActive = (to) => (BELONGS[to] || [to]).some((p) => pathname.endsWith(p) || pathname.includes(`${p}/`));

  return (
    <nav
      aria-label={pt ? 'Navegação principal' : 'Main navigation'}
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-end justify-between px-2 border-t bg-[var(--rw-surface)] border-[var(--rw-border)]"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', height: 'calc(64px + env(safe-area-inset-bottom))' }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.to);
        const label = pt ? tab.pt : tab.en;
        if (tab.center) {
          return (
            <NavLink key={tab.to} to={tab.to} aria-label={pt ? 'Falar com o Elio' : 'Talk to Elio'} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold text-[var(--rw-brand-ink)]">
              <span className="-mt-6 w-14 h-14 rounded-full bg-[var(--rw-brand)] text-white flex items-center justify-center border-4 border-[var(--rw-bg)]">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" /></svg>
              </span>
              {label}
            </NavLink>
          );
        }
        return (
          <NavLink key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} className={`flex-1 flex flex-col items-center gap-1 pt-2 min-h-[44px] text-[11px] font-semibold ${active ? 'text-[var(--rw-brand-ink)]' : 'text-[var(--rw-subtle)]'}`}>
            <Icon>{tab.icon}</Icon>
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
