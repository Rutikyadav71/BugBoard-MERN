import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-2">Go home</Link>
    </div>
  );
}
