import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert size={48} className="text-amber-500" />
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="max-w-sm text-sm text-slate-500">Your role does not have permission to view this page.</p>
      <Link to="/dashboard" className="btn-primary mt-2">Back to dashboard</Link>
    </div>
  );
}
