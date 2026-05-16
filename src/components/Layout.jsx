import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      {/* Main content area */}
      <main className="lg:ml-64">
        <Outlet />
      </main>
    </div>
  );
}
