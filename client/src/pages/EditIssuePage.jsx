import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { getErrorMessage } from '../api/client.js';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../components/Toast.jsx';
import IssueForm from '../components/IssueForm.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function EditIssuePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: issue, loading, error } = useAsync(() => issuesApi.get(id), [id]);
  const [serverError, setServerError] = useState('');

  const onSubmit = async ({ title, description, severity, priority }) => {
    setServerError('');
    try {
      await issuesApi.update(id, { title, description, severity, priority });
      toast.success('Issue updated');
      navigate(`/issues/${id}`);
    } catch (err) { setServerError(getErrorMessage(err, 'Could not update issue')); }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="mx-auto max-w-lg space-y-3 pt-8 text-center"><ErrorMessage message={error} /><Link to="/issues" className="btn-secondary">Back to issues</Link></div>;
  if (!issue.capabilities.canEdit) return <div className="mx-auto max-w-lg space-y-3 pt-8 text-center"><ErrorMessage message="You do not have permission to edit this issue." /><Link to={`/issues/${id}`} className="btn-secondary">Back to issue</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to={`/issues/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to {issue.key}</Link>
      <h1 className="text-2xl font-bold text-slate-900">Edit {issue.key}</h1>
      <IssueForm isEdit initial={issue} onSubmit={onSubmit} onCancel={() => navigate(`/issues/${id}`)} serverError={serverError} />
    </div>
  );
}
