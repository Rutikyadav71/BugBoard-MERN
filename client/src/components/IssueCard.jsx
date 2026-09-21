import { Link } from 'react-router-dom';
import { PriorityBadge, SeverityBadge } from './Badges.jsx';

// Compact card used on the Kanban board and dashboard lists.
export default function IssueCard({ issue, dragging = false }) {
  const initials = issue.assignee?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={`min-w-0 rounded-lg border bg-white p-3 shadow-sm transition ${dragging ? 'border-brand-400 shadow-lg ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-slate-300 hover:shadow'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{issue.key}</span>
        <div className="flex gap-1"><SeverityBadge severity={issue.severity} /></div>
      </div>
      <Link to={`/issues/${issue._id}`} className="mt-1 block break-words text-sm font-medium text-slate-900 hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
        {issue.title}
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={issue.priority} />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {issue.reporter?.name && <span className="hidden truncate sm:inline" title={`Reporter: ${issue.reporter.name}`}>by {issue.reporter.name.split(' ')[0]}</span>}
          {initials ? (
            <span title={`Assignee: ${issue.assignee.name}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">{initials}</span>
          ) : (
            <span title="Unassigned" className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400">?</span>
          )}
        </div>
      </div>
    </div>
  );
}
