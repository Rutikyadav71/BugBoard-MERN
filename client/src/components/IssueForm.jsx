import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import ErrorMessage from './ErrorMessage.jsx';
import { PRIORITIES, SEVERITIES } from '../utils/constants.js';

// Used for both "create" and "edit". In edit mode the project is fixed (an issue cannot move projects).
export default function IssueForm({ initial, projects = [], assignable = [], canAssign = false, isEdit = false, onProjectChange, onSubmit, onCancel, serverError }) {
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: initial?.title || '',
      description: initial?.description || '',
      project: initial?.project?._id || initial?.project || projects[0]?._id || '',
      severity: initial?.severity || 'Medium',
      priority: initial?.priority || 'Medium',
      assignee: initial?.assignee?._id || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-4 sm:p-6">
      <ErrorMessage message={serverError} />
      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" className="input" placeholder="Short summary of the problem" aria-invalid={Boolean(errors.title)}
          {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Title must be at least 3 characters' }, maxLength: { value: 200, message: 'Title must be 200 characters or fewer' } })} />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <label htmlFor="description" className="label">Description</label>
        <textarea id="description" rows={6} className="input" placeholder="Steps to reproduce, expected and actual behaviour…" aria-invalid={Boolean(errors.description)}
          {...register('description', { required: 'Description is required', minLength: { value: 5, message: 'Description must be at least 5 characters' }, maxLength: { value: 5000, message: 'Description must be 5000 characters or fewer' } })} />
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {!isEdit && (
          <div className="sm:col-span-2">
            <label htmlFor="project" className="label">Project</label>
            <select id="project" className="input" aria-invalid={Boolean(errors.project)}
              {...register('project', { required: 'Choose a project', onChange: (e) => onProjectChange?.(e.target.value) })}>
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => <option key={p._id} value={p._id}>{p.key} - {p.name}</option>)}
            </select>
            {errors.project && <p className="mt-1 text-xs text-red-600">{errors.project.message}</p>}
          </div>
        )}
        <div>
          <label htmlFor="severity" className="label">Severity</label>
          <select id="severity" className="input" {...register('severity')}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label htmlFor="priority" className="label">Priority</label>
          <select id="priority" className="input" {...register('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        {canAssign && !isEdit && (
          <div className="sm:col-span-2">
            <label htmlFor="assignee" className="label">Assignee (optional)</label>
            <select id="assignee" className="input" {...register('assignee')}>
              <option value="">Unassigned</option>
              {assignable.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting || projects.length === 0}>
          {isSubmitting && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Save changes' : 'Create issue'}
        </button>
      </div>
    </form>
  );
}
