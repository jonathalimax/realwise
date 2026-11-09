import { Outlet } from 'react-router-dom';
import { NavDrawerProvider } from '../contexts/NavDrawerContext';
import Sidebar from './Sidebar';
import AnnouncementBanner from './AnnouncementBanner';
import ScrollManager from './ScrollManager';
import PushPermissionSheet from './PushPermissionSheet';

/** The chat is home. Every other place opens from the hamburger drawer (mobile) or the sidebar (desktop). */
export default function Layout() {
  return (
    <NavDrawerProvider>
      <div className="min-h-screen bg-[var(--rw-bg)]">
        <ScrollManager />
        <Sidebar />

        <main className="lg:ml-64">
          <AnnouncementBanner />
          <Outlet />
        </main>
        <PushPermissionSheet />
      </div>
    </NavDrawerProvider>
  );
}
