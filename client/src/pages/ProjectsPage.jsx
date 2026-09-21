import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { projectsApi } from '../api/projects.js';
import useAsync from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import Pagination from '../components/Pagination.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const page = Number(params.get('page')) || 1;

  const { data, loading, error, reload } = useAsync(() => projectsApi.list({ search: search || undefined, page, limit: 9 }), [search, page]);

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  }, [params, setParams]);
  const onSearch = useCallback((v) => update({ search: v, page: '' }), [update]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Projects you are a member of</p>
        </div>
        {user.role === 'Admin' && <Link to="/projects/new" className="btn-primary"><Plus size={16} /> New project</Link>}
      </div>
      <div className="max-w-sm"><SearchBar value={search} onSearch={onSearch} placeholder="Search projects…" /></div>

      {loading && <LoadingSpinner />}
      {error && (
        <div className="space-y-2"><ErrorMessage message={error} /><button type="button" className="btn-secondary" onClick={() => reload()}>Try again</button></div>
      )}
      {!loading && !error && data?.items.length === 0 && (
        <EmptyState icon={FolderKanban} title={search ? 'No matching projects' : 'No projects yet'}
          message={search ? 'Try a different search term.' : user.role === 'Admin' ? 'Create your first project to start tracking issues.' : 'You have not been added to any project yet. Ask an Admin to add you.'}
          action={!search && user.role === 'Admin' ? <Link to="/projects/new" className="btn-primary"><Plus size={16} /> New project</Link> : null} />
      )}
      {!loading && !error && data?.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((p) => <ProjectCard key={p._id} project={p} />)}</div>
          <Pagination meta={data.meta} onPageChange={(p) => update({ page: p > 1 ? String(p) : '' })} />
        </>
      )}
    </div>
  );
}
