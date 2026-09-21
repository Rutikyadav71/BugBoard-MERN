import { Link, useSearchParams } from 'react-router-dom';
import { Bug, CircleDot, Loader, AlertOctagon, CheckCircle2, UserCheck, FlaskConical, PenLine } from 'lucide-react';
import { dashboardApi } from '../api/issues.js';
import useAsync from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { StatusChart, PriorityChart } from '../components/DashboardCharts.jsx';
import { StatusBadge, PriorityBadge } from '../components/Badges.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { timeAgo } from '../utils/constants.js';

const HEADLINE = {
  Admin: 'Overview of the projects you administer',
  Developer: 'Your assigned work and project activity',
  Tester: 'Issues you have reported and are tracking',
};

function IssueList({ title, issues, empty, viewAllTo }) {
  return (
    <section className="card min-w-0 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{viewAllTo && <Link to={viewAllTo} className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>}</div>
      {issues.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {issues.map((i) => (
            <li key={i._id}>
              <Link to={`/issues/${i._id}`} className="flex flex-col gap-1.5 py-2.5 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800"><span className="mr-2 font-mono text-xs text-slate-500">{i.key}</span>{i.title}</p><p className="text-xs text-slate-400">{i.project?.name} · {timeAgo(i.updatedAt)}</p></div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5"><PriorityBadge priority={i.priority} /><StatusBadge status={i.status} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const project = params.get('project') || '';
  const stats = useAsync(() => dashboardApi.stats({ project: project || undefined }), [project]);
  const assigned = useAsync(() => (user.role === 'Developer' ? dashboardApi.assigned() : Promise.resolve([])), [user.role]);

  // Build "/issues" or "/issues?status=Open&project=..." (never a dangling "?").
  const link = (q = '') => {
    const qs = [q, project ? `project=${project}` : ''].filter(Boolean).join('&');
    return qs ? `/issues?${qs}` : '/issues';
  };

  if (stats.loading && !stats.data) return <LoadingSpinner />;
  if (stats.error && !stats.data) return <div className="space-y-3"><ErrorMessage message={stats.error} /><button type="button" className="btn-secondary" onClick={() => stats.reload()}>Try again</button></div>;
  const d = stats.data;
  const s = d.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">Welcome back, {user.name.split(' ')[0]}</h1><p className="text-sm text-slate-500">{HEADLINE[user.role]}</p></div>
        <div className="w-full sm:w-auto">
          <label htmlFor="dash-project" className="label text-xs">Project</label>
          <select id="dash-project" className="input w-full py-1.5 sm:w-56" value={project} onChange={(e) => { const n = new URLSearchParams(); if (e.target.value) n.set('project', e.target.value); setParams(n); }}>
            <option value="">All projects</option>
            {d.projects.map((p) => <option key={p._id} value={p._id}>{p.key} - {p.name}</option>)}
          </select>
        </div>
      </div>

      {d.projects.length === 0 ? (
        <EmptyState icon={Bug} title="No projects yet" message={user.role === 'Admin' ? 'Create a project to start tracking issues.' : 'You have not been added to a project yet.'}
          action={user.role === 'Admin' ? <Link to="/projects/new" className="btn-primary">Create project</Link> : null} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DashboardCard label="Total issues" value={s.total} icon={Bug} tone="brand" to={link('')} />
            <DashboardCard label="Open issues" value={s.open} icon={CircleDot} tone="slate" to={link('status=Open')} />
            <DashboardCard label="In progress" value={s.inProgress} icon={Loader} tone="blue" to={link('status=In Progress')} />
            <DashboardCard label="Critical (active)" value={s.critical} icon={AlertOctagon} tone="red" to={link('severity=Critical&status=Open,In Progress,Testing')} />
            <DashboardCard label="Resolved issues" value={s.resolved} icon={CheckCircle2} tone="emerald" to={link('status=Resolved')} />
            {user.role === 'Tester'
              ? <DashboardCard label="Reported by me" value={s.reportedByMe} icon={PenLine} tone="amber" to={link(`reporter=${user._id}`)} />
              : user.role === 'Developer'
                ? <DashboardCard label="Assigned to me" value={s.assignedToMe} icon={UserCheck} tone="amber" to={link('assignee=me')} />
                : <DashboardCard label="In testing" value={s.testing} icon={FlaskConical} tone="amber" to={link('status=Testing')} />}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="card min-w-0 p-4 sm:p-5"><h2 className="mb-2 text-base font-semibold text-slate-900">Status distribution</h2><StatusChart data={d.byStatus} /></section>
            <section className="card min-w-0 p-4 sm:p-5"><h2 className="mb-2 text-base font-semibold text-slate-900">Priority distribution</h2><PriorityChart data={d.byPriority} /></section>
          </div>

          {user.role === 'Developer' && (
            <IssueList title="My assigned issues" issues={assigned.data || []} empty={assigned.loading ? 'Loading…' : 'Nothing is assigned to you right now.'} viewAllTo={link('assignee=me')} />
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <IssueList title="Recent issues" issues={d.recentIssues} empty="No issues yet." viewAllTo={link('')} />
            <IssueList title="Recently updated" issues={d.recentlyUpdated} empty="No activity yet." viewAllTo={link('sortBy=updatedAt&order=desc')} />
          </div>
        </>
      )}
    </div>
  );
}
