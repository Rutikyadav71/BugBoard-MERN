import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, UserMinus, UserPlus, KanbanSquare, Check, X } from 'lucide-react';
import { projectsApi } from '../api/projects.js';
import { issuesApi } from '../api/issues.js';
import { getErrorMessage } from '../api/client.js';
import useAsync from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import IssueTable from '../components/IssueTable.jsx';
import RoleBadge from '../components/RoleBadge.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'Admin';

  const project = useAsync(() => projectsApi.get(id), [id]);
  const issues = useAsync(() => issuesApi.list({ project: id, limit: 8, sortBy: 'updatedAt' }), [id]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [toAdd, setToAdd] = useState('');
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (project.data) setForm({ name: project.data.name, description: project.data.description || '' }); }, [project.data]);
  useEffect(() => { if (isAdmin) projectsApi.users().then(setDirectory).catch(() => {}); }, [isAdmin]);

  if (project.loading && !project.data) return <LoadingSpinner />;
  if (project.error) return (
    <div className="mx-auto max-w-lg space-y-3 pt-8 text-center"><ErrorMessage message={project.error} /><Link to="/projects" className="btn-secondary">Back to projects</Link></div>
  );
  const p = project.data;
  const memberIds = new Set(p.members.map((m) => m._id));
  const candidates = directory.filter((u) => !memberIds.has(u._id));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      project.setData(await projectsApi.update(id, form));
      setEditing(false);
      toast.success('Project updated');
    } catch (err) { toast.error(getErrorMessage(err, 'Could not update project')); } finally { setSaving(false); }
  };

  const addMember = async () => {
    if (!toAdd) return;
    setBusy(true);
    try { project.setData(await projectsApi.updateMembers(id, { add: [toAdd] })); setToAdd(''); toast.success('Member added'); }
    catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  const removeMember = async () => {
    setBusy(true);
    try { project.setData(await projectsApi.updateMembers(id, { remove: [removing._id] })); toast.success(`${removing.name} removed`); setRemoving(null); }
    catch (err) { toast.error(getErrorMessage(err)); setRemoving(null); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to projects</Link>

      <div className="card p-4 sm:p-6">
        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <div><label htmlFor="pname" className="label">Name</label><input id="pname" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></div>
            <div><label htmlFor="pdesc" className="label">Description</label><textarea id="pdesc" rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}><Check size={16} /> Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}><X size={16} /> Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="break-words text-2xl font-bold text-slate-900">{p.name}</h1>
                <span className="rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand-700">{p.key}</span>
              </div>
              <p className="mt-2 max-w-2xl break-words text-sm text-slate-600">{p.description || 'No description'}</p>
              <p className="mt-2 text-xs text-slate-400">Created by {p.createdBy?.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/board?project=${p._id}`} className="btn-secondary"><KanbanSquare size={16} /> Board</Link>
              <Link to={`/issues/new?project=${p._id}`} className="btn-primary"><Plus size={16} /> New issue</Link>
              {isAdmin && <button type="button" className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={16} /> Edit</button>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card min-w-0 p-5 lg:col-span-1">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Members ({p.members.length})</h2>
          <ul className="divide-y divide-slate-100">
            {p.members.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
                <div className="min-w-0 flex-1 basis-40"><p className="truncate text-sm font-medium text-slate-800">{m.name}</p><p className="truncate text-xs text-slate-500" title={m.email}>{m.email}</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={m.role} />
                  {isAdmin && m._id !== p.createdBy._id && (
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`}><UserMinus size={16} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label htmlFor="addMember" className="label text-xs">Add member</label>
              <div className="flex gap-2">
                <select id="addMember" className="input min-w-0 py-1.5" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                  <option value="">Select a user…</option>
                  {candidates.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
                <button type="button" className="btn-primary px-3" onClick={addMember} disabled={!toAdd || busy} aria-label="Add selected member"><UserPlus size={16} /></button>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Recent issues</h2>
            <Link to={`/issues?project=${p._id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          {issues.loading && <LoadingSpinner />}
          {issues.error && <ErrorMessage message={issues.error} />}
          {!issues.loading && !issues.error && issues.data?.items.length === 0 && <EmptyState title="No issues yet" message="Issues reported in this project will appear here." />}
          {issues.data?.items.length > 0 && <IssueTable issues={issues.data.items} />}
        </section>
      </div>

      <ConfirmationModal open={Boolean(removing)} danger loading={busy} title="Remove member?"
        message={`${removing?.name} will lose access to this project. Members with active assigned issues cannot be removed until those are reassigned.`}
        confirmLabel="Remove" onConfirm={removeMember} onCancel={() => setRemoving(null)} />
    </div>
  );
}
