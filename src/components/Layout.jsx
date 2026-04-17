import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function Layout() {
  usePushNotifications();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      {/* Main content area */}
      <main className="md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}
