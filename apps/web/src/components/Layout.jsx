import { Outlet, useLocation } from 'react-router-dom';
import { hidesTabBar } from '../lib/tabBar';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import AnnouncementBanner from './AnnouncementBanner';

export default function Layout() {
  const { pathname } = useLocation();
  // Leave room for the tab bar only where it shows (the chat would otherwise get a dead strip under its composer).
  const room = hidesTabBar(pathname) ? '' : 'pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0';
  return (
    <div className="min-h-screen bg-[var(--rw-bg)]">
      <Sidebar />

      {/* Main content area */}
      <main className={`lg:ml-64 ${room}`}>
        <AnnouncementBanner />
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
