import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  return (
    <div className="app-shell flex overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
