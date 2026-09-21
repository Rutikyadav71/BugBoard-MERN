import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import RoleBadge from './RoleBadge.jsx';

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-slate-800">{user.name}</span>
          <span className="block text-xs text-slate-500">{user.role}</span>
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2"><RoleBadge role={user.role} /></div>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <button role="menuitem" type="button" onClick={() => { setOpen(false); navigate('/profile'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <UserIcon size={16} /> My profile
          </button>
          <button role="menuitem" type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
