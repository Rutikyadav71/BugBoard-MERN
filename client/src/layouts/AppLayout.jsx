import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  // The Kanban board manages its own scrolling. The drag-and-drop library supports exactly one scroll
  // container above a droppable list, so <main> must not scroll on that route.
  const { pathname } = useLocation();
  const ownsScroll = pathname === '/board' || pathname.startsWith('/board/');
  return (
    <div className="app-shell flex overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className={`min-w-0 flex-1 p-4 sm:p-6 ${ownsScroll ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
