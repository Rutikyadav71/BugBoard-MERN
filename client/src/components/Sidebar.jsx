import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Bug, LayoutDashboard, FolderKanban, ListChecks, KanbanSquare, X } from 'lucide-react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/issues', label: 'Issues', icon: ListChecks },
  { to: '/board', label: 'Kanban board', icon: KanbanSquare },
];

export default function Sidebar({ open, onClose }) {
  // Mobile drawer: Escape closes it. Nothing here runs on desktop, where the sidebar is always visible.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col bg-navy-900 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Sidebar"
        id="app-sidebar"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600"><Bug size={20} /></span>
            <span className="text-lg font-bold tracking-tight">BugBoard</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white lg:hidden" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white'}`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <p className="px-5 py-4 text-xs text-slate-500">BugBoard v1.0</p>
      </aside>
    </>
  );
}
