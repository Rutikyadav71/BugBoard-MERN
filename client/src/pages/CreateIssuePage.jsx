import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';
import { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import IssueForm from '../components/IssueForm.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function CreateIssuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [assignable, setAssignable] = useState([]);
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');

  const loadAssignable = useCallback((projectId) => {
    if (user.role !== 'Admin' || !projectId) return;
    projectsApi.assignable(projectId).then(setAssignable).catch(() => setAssignable([]));
  }, [user.role]);

  useEffect(() => {
    projectsApi.list({ limit: 100 }).then((r) => {
      const wanted = params.get('project');
      const ordered = wanted ? [...r.items].sort((a) => (a._id === wanted ? -1 : 1)) : r.items;
      setProjects(ordered);
      loadAssignable(ordered[0]?._id);
    }).catch((e) => setError(getErrorMessage(e)));
  }, [params, loadAssignable]);

  const onSubmit = async (values) => {
    setServerError('');
    const payload = { ...values, assignee: values.assignee || null };
    try {
      const issue = await issuesApi.create(payload);
      toast.success(`Issue ${issue.key} created`);
      navigate(`/issues/${issue._id}`);
    } catch (err) { setServerError(getErrorMessage(err, 'Could not create issue')); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/issues" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to issues</Link>
      <h1 className="text-2xl font-bold text-slate-900">Report an issue</h1>
      {error && <ErrorMessage message={error} />}
      {!projects && !error && <LoadingSpinner />}
      {projects && projects.length === 0 && <ErrorMessage message="You are not a member of any project yet, so you cannot report issues. Ask an Admin to add you." />}
      {projects && projects.length > 0 && (
        <IssueForm projects={projects} assignable={assignable} canAssign={user.role === 'Admin'} onProjectChange={loadAssignable}
          onSubmit={onSubmit} onCancel={() => navigate(-1)} serverError={serverError} />
      )}
    </div>
  );
}
