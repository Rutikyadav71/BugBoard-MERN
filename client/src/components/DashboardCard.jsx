import { Link } from 'react-router-dom';

const TONES = {
  slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-100 text-blue-600', red: 'bg-red-100 text-red-600',
  emerald: 'bg-emerald-100 text-emerald-600', amber: 'bg-amber-100 text-amber-600', brand: 'bg-brand-100 text-brand-600',
};

// Always a link: clicking a card opens the issue list with the matching filter applied.
export default function DashboardCard({ label, value, icon: Icon, tone = 'slate', to }) {
  return (
    <Link to={to} className="card group flex min-w-0 items-center gap-4 p-4 transition sm:p-5 hover:border-brand-300 hover:shadow-md" aria-label={`${label}: ${value}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}><Icon size={22} /></span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-sm text-slate-500 group-hover:text-brand-600">{label}</p>
      </div>
    </Link>
  );
}
