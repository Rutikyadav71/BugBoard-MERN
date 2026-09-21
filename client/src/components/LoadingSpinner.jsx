import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label = 'Loading…', fullScreen = false }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 text-slate-500 ${fullScreen ? 'min-h-screen' : 'py-12'}`}
    >
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
