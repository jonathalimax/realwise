import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import { PlanBar } from './billing/PlanBadge';
import AnnouncementBanner from './AnnouncementBanner';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[var(--rw-bg)]">
      <Sidebar />

      {/* Main content area */}
      <main className="lg:ml-64 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
        <AnnouncementBanner />
        <PlanBar />
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
