import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bug, Plus, ArrowUpDown } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';
import useAsync from '../hooks/useAsync.js';
import IssueTable from '../components/IssueTable.jsx';
import SearchBar from '../components/SearchBar.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import Pagination from '../components/Pagination.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

const FILTER_KEYS = ['project', 'status', 'priority', 'severity', 'assignee', 'reporter'];
const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' }, { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' }, { value: 'priority:desc', label: 'Priority (high to low)' },
  { value: 'severity:desc', label: 'Severity (high to low)' }, { value: 'status:asc', label: 'Status' }, { value: 'title:asc', label: 'Title (A-Z)' },
];

// The URL is the single source of truth for filters, so dashboard cards can deep-link
// (e.g. /issues?status=Open) and the browser back button behaves as expected.
export default function IssuesPage() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState([]);

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])), [params]);
  const search = params.get('search') || '';
  const page = Number(params.get('page')) || 1;
  const sort = `${params.get('sortBy') || 'createdAt'}:${params.get('order') || 'desc'}`;

  useEffect(() => { projectsApi.list({ limit: 100 }).then((r) => setProjects(r.items)).catch(() => {}); }, []);

  const [sortBy, order] = sort.split(':');
  const query = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), search: search || undefined, sortBy, order, page, limit: 10 };
  const { data, loading, error, reload } = useAsync(() => issuesApi.list(query), [params.toString()]);

  // People for the assignee/reporter dropdowns: members of the visible projects.
  const people = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => p.members?.forEach((m) => map.set(m._id, m)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const update = useCallback((patch, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (resetPage) next.delete('page');
    setParams(next);
  }, [params, setParams]);
  const onSearch = useCallback((v) => update({ search: v }), [update]);
  const clear = () => setParams(new URLSearchParams());

  const hasFilters = Object.values(filters).some(Boolean) || search;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Issues</h1><p className="text-sm text-slate-500">{data?.meta ? `${data.meta.total} issue${data.meta.total === 1 ? '' : 's'}` : ' '}</p></div>
        <Link to="/issues/new" className="btn-primary"><Plus size={16} /> New issue</Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:min-w-[14rem] sm:flex-1 sm:max-w-sm"><SearchBar value={search} onSearch={onSearch} placeholder="Search title, description or key…" /></div>
        <label className="flex w-full items-center gap-2 text-sm text-slate-600 sm:w-auto"><ArrowUpDown size={16} className="shrink-0" />
          <select className="input min-w-0 py-1.5" value={sort} aria-label="Sort issues" onChange={(e) => { const [s, o] = e.target.value.split(':'); update({ sortBy: s, order: o }); }}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <FilterPanel filters={filters} onChange={update} onClear={clear} projects={projects} people={people} />

      {loading && <LoadingSpinner />}
      {error && <div className="space-y-2"><ErrorMessage message={error} /><button type="button" className="btn-secondary" onClick={() => reload()}>Try again</button></div>}
      {!loading && !error && data?.items.length === 0 && (
        <EmptyState icon={Bug} title={hasFilters ? 'No issues match your filters' : 'No issues yet'}
          message={hasFilters ? 'Try removing some filters or changing your search.' : 'Report the first bug to get started.'}
          action={hasFilters ? <button type="button" className="btn-secondary" onClick={clear}>Clear filters</button> : <Link to="/issues/new" className="btn-primary"><Plus size={16} /> New issue</Link>} />
      )}
      {!loading && !error && data?.items.length > 0 && (
        <>
          <IssueTable issues={data.items} />
          <Pagination meta={data.meta} onPageChange={(p) => update({ page: p > 1 ? String(p) : '' }, false)} />
        </>
      )}
    </div>
  );
}
