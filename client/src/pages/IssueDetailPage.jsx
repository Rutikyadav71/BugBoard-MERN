import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';
import { getErrorMessage } from '../api/client.js';
import useAsync from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { StatusBadge, PriorityBadge, SeverityBadge } from '../components/Badges.jsx';
import CommentSection from '../components/CommentSection.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatDateTime } from '../utils/constants.js';

const Field = ({ label, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"><dt className="text-sm text-slate-500">{label}</dt><dd className="min-w-0 break-words text-right text-sm font-medium text-slate-800">{children}</dd></div>
);

export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const issue = useAsync(() => issuesApi.get(id), [id]);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [assignable, setAssignable] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSide = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([issuesApi.comments(id), issuesApi.activity(id)]);
      setComments(c); setActivity(a);
    } catch (err) { toast.error(getErrorMessage(err)); }
  }, [id, toast]);

  useEffect(() => { loadSide(); }, [loadSide]);

  const projectId = issue.data?.project?._id;
  useEffect(() => {
    if (user.role === 'Admin' && projectId) projectsApi.assignable(projectId).then(setAssignable).catch(() => setAssignable([]));
  }, [user.role, projectId]);

  if (issue.loading && !issue.data) return <LoadingSpinner />;
  if (issue.error) return <div className="mx-auto max-w-lg space-y-3 pt-8 text-center"><ErrorMessage message={issue.error} /><Link to="/issues" className="btn-secondary">Back to issues</Link></div>;

  const i = issue.data;
  const caps = i.capabilities;
  const active = !['Resolved', 'Closed'].includes(i.status);

  // Every change goes through the API; on success the server's version replaces local state and the timeline reloads.
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { issue.setData(await fn()); toast.success(okMsg); await loadSide(); }
    catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await issuesApi.remove(id); toast.success(`${i.key} deleted`); navigate('/issues', { replace: true }); }
    catch (err) { toast.error(getErrorMessage(err)); setConfirmDelete(false); setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/issues" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to issues</Link>

      <header className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-64">
            <p className="break-words font-mono text-sm text-slate-500"><Link to={`/projects/${i.project._id}`} className="hover:text-brand-600">{i.project.name}</Link> / {i.key}</p>
            <h1 className="mt-1 break-words text-xl font-bold text-slate-900 sm:text-2xl">{i.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={i.status} /><PriorityBadge priority={i.priority} /><SeverityBadge severity={i.severity} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {caps.canEdit && <Link to={`/issues/${i._id}/edit`} className="btn-secondary"><Pencil size={16} /> Edit</Link>}
            {caps.canDelete && <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={16} /> Delete</button>}
          </div>
        </div>

        {caps.allowedTransitions.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">Move to:</span>
            {caps.allowedTransitions.map((s) => (
              <button key={s} type="button" className="btn-secondary py-1.5" disabled={busy} onClick={() => run(() => issuesApi.setStatus(id, s), `Status changed to ${s}`)}><ArrowRight size={14} /> {s}</button>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="card p-4 sm:p-5"><h2 className="mb-2 text-base font-semibold text-slate-900">Description</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{i.description}</p></section>
          <CommentSection issueId={id} comments={comments} onAdded={(c) => setComments((list) => [...list, c])} />
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Details</h2>
            <dl className="divide-y divide-slate-100">
              <Field label="Reporter">{i.reporter?.name}</Field>
              <Field label="Assignee">
                {caps.canAssign && active ? (
                  <select className="input w-full min-w-0 py-1 sm:w-44" aria-label="Assignee" value={i.assignee?._id || ''} disabled={busy}
                    onChange={(e) => run(() => issuesApi.assign(id, e.target.value || null), 'Assignee updated')}>
                    <option value="">Unassigned</option>
                    {assignable.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select>
                ) : (i.assignee?.name || <span className="font-normal text-slate-400">Unassigned</span>)}
              </Field>
              <Field label="Created">{formatDateTime(i.createdAt)}</Field>
              <Field label="Updated">{formatDateTime(i.updatedAt)}</Field>
            </dl>
          </section>
          <ActivityTimeline items={activity} />
        </aside>
      </div>

      <ConfirmationModal open={confirmDelete} danger loading={busy} title={`Delete ${i.key}?`}
        message="This permanently deletes the issue along with its comments and activity history. This cannot be undone."
        confirmLabel="Delete issue" onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
