import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge, SeverityBadge } from './Badges.jsx';
import { formatDate } from '../utils/constants.js';
import useMediaQuery from '../hooks/useMediaQuery.js';

// Below the `md` breakpoint (768px) each issue becomes a card so nothing needs sideways scrolling.
// From `md` up the original table is rendered unchanged. Only one layout is mounted at a time.
function IssueCards({ issues }) {
  return (
    <ul className="space-y-3" aria-label="Issues">
      {issues.map((i) => (
        <li key={i._id} className="card min-w-0 p-4">
          <Link to={`/issues/${i._id}`} className="block min-w-0 hover:text-brand-600">
            <span className="block font-mono text-xs text-slate-500">{i.key}</span>
            <span className="mt-0.5 block break-words text-sm font-medium text-slate-900">{i.title}</span>
          </Link>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusBadge status={i.status} />
            <PriorityBadge priority={i.priority} />
            <SeverityBadge severity={i.severity} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="min-w-0"><dt className="text-slate-400">Assignee</dt><dd className="truncate text-slate-700">{i.assignee?.name || 'Unassigned'}</dd></div>
            <div className="min-w-0"><dt className="text-slate-400">Reporter</dt><dd className="truncate text-slate-700">{i.reporter?.name || '-'}</dd></div>
            <div className="min-w-0"><dt className="text-slate-400">Updated</dt><dd className="text-slate-700">{formatDate(i.updatedAt)}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export default function IssueTable({ issues }) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true);
  if (!isDesktop) return <IssueCards issues={issues} />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="hidden px-4 py-3 lg:table-cell">Reporter</th>
              <th className="hidden px-4 py-3 md:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issues.map((i) => (
              <tr key={i._id} className="transition hover:bg-slate-50">
                <td className="max-w-xs px-4 py-3">
                  <Link to={`/issues/${i._id}`} className="block font-medium text-slate-900 hover:text-brand-600">
                    <span className="mr-2 font-mono text-xs text-slate-500">{i.key}</span>
                    <span className="break-words">{i.title}</span>
                  </Link>
                </td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={i.priority} /></td>
                <td className="px-4 py-3"><SeverityBadge severity={i.severity} /></td>
                <td className="px-4 py-3 text-slate-600">{i.assignee?.name || <span className="text-slate-400">Unassigned</span>}</td>
                <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{i.reporter?.name}</td>
                <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{formatDate(i.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
