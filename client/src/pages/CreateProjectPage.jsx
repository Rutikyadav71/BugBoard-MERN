import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { projectsApi } from '../api/projects.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { useToast } from '../components/Toast.jsx';
import RoleBadge from '../components/RoleBadge.jsx';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', key: '', description: '' } });

  useEffect(() => { projectsApi.users().then(setUsers).catch((e) => setServerError(getErrorMessage(e))); }, []);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const project = await projectsApi.create({ ...values, members: selected });
      toast.success(`Project ${project.key} created`);
      navigate(`/projects/${project._id}`);
    } catch (err) { setServerError(getErrorMessage(err, 'Could not create project')); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Back to projects</Link>
      <h1 className="text-2xl font-bold text-slate-900">New project</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-4 sm:p-6">
        <ErrorMessage message={serverError} />
        <div>
          <label htmlFor="name" className="label">Project name</label>
          <input id="name" className="input" aria-invalid={Boolean(errors.name)} {...register('name', { required: 'Project name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="key" className="label">Project key</label>
          <input id="key" className="input font-mono uppercase" maxLength={10} placeholder="e.g. WEB" aria-invalid={Boolean(errors.key)}
            {...register('key', { required: 'Project key is required', pattern: { value: /^[A-Za-z][A-Za-z0-9]{1,9}$/, message: 'Use 2-10 letters/digits, starting with a letter' }, onChange: (e) => setValue('key', e.target.value.toUpperCase()) })} />
          <p className="mt-1 text-xs text-slate-500">Used to number issues (e.g. WEB-1). Cannot be changed later.</p>
          {errors.key && <p className="mt-1 text-xs text-red-600">{errors.key.message}</p>}
        </div>
        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" rows={3} className="input" {...register('description', { maxLength: { value: 1000, message: 'Description is too long' } })} />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
        </div>
        <fieldset>
          <legend className="label">Team members</legend>
          <p className="mb-2 text-xs text-slate-500">You are added automatically. Select anyone else who should have access.</p>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {users.map((u) => (
              <label key={u._id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={selected.includes(u._id)} onChange={() => toggle(u._id)} />
                <span className="flex-1 text-sm text-slate-800">{u.name} <span className="text-slate-400">{u.email}</span></span>
                <RoleBadge role={u.role} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate('/projects')} disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Loader2 size={16} className="animate-spin" />} Create project</button>
        </div>
      </form>
    </div>
  );
}
