import { Menu } from 'lucide-react';
import ProfileMenu from './ProfileMenu.jsx';

export default function Navbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenuClick} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu" aria-controls="app-sidebar">
        <Menu size={20} />
      </button>
      <div className="hidden lg:block" />
      <ProfileMenu />
    </header>
  );
}
