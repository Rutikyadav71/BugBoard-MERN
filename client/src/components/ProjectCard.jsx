import { Link } from 'react-router-dom';
import { Users, Bug } from 'lucide-react';

export default function ProjectCard({ project }) {
  const stats = project.issueStats || { total: 0, open: 0 };
  return (
    <Link to={`/projects/${project._id}`} className="card group block min-w-0 p-4 transition sm:p-5 hover:border-brand-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-600">{project.name}</h3>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">{project.description || 'No description'}</p>
        </div>
        <span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand-700">{project.key}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users size={14} /> {project.members?.length || 0} members</span>
        <span className="flex items-center gap-1"><Bug size={14} /> {stats.open} active / {stats.total} total</span>
      </div>
    </Link>
  );
}
