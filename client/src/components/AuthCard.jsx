import { Bug } from 'lucide-react';

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-brand-700/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <Bug size={26} />
          </div>
          <span className="text-2xl font-bold tracking-tight">BugBoard</span>
        </div>
        <div className="card p-5 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-300">{footer}</div>}
      </div>
    </div>
  );
}
