import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSquare, Plus } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';
import { getErrorMessage } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';
import IssueCard from '../components/IssueCard.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import SearchBar from '../components/SearchBar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { STATUSES } from '../utils/constants.js';

const COLUMN_TONE = {
  Open: 'border-t-slate-400', 'In Progress': 'border-t-blue-500', Testing: 'border-t-amber-500', Resolved: 'border-t-emerald-500', Closed: 'border-t-zinc-500',
};
const FILTER_KEYS = ['project', 'priority', 'severity', 'assignee'];

export default function BoardPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState(null); // id of the issue whose move is awaiting the server
  const [draggingFrom, setDraggingFrom] = useState(null);

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])), [params]);
  const search = params.get('search') || '';

  useEffect(() => { projectsApi.list({ limit: 100 }).then((r) => setProjects(r.items)).catch(() => {}); }, []);

  const people = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => p.members?.forEach((m) => map.set(m._id, m)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), search: search || undefined, limit: 100, sortBy: 'priority', order: 'desc' };
      const { items } = await issuesApi.list(query); // each item already carries the caller's capabilities
      setIssues(items);
    } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  }, [filters, search]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  }, [params, setParams]);
  const onSearch = useCallback((v) => update({ search: v }), [update]);

  const columns = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s, []]));
    issues.forEach((i) => by[i.status]?.push(i));
    return by;
  }, [issues]);

  const onDragStart = (start) => setDraggingFrom(issues.find((i) => i._id === start.draggableId) || null);

  const onDragEnd = async (result) => {
    const issue = draggingFrom;
    setDraggingFrom(null);
    const { destination, source, draggableId } = result;
    if (!destination || !issue || destination.droppableId === source.droppableId) return;
    const target = destination.droppableId;

    // The server is the authority. Optimistic move first, then confirm or roll back.
    const snapshot = issues;
    setIssues((list) => list.map((i) => (i._id === draggableId ? { ...i, status: target } : i)));
    setMoving(draggableId);
    try {
      const updated = await issuesApi.setStatus(draggableId, target);
      setIssues((list) => list.map((i) => (i._id === draggableId ? updated : i)));
      toast.success(`${issue.key} moved to ${target}`);
    } catch (err) {
      setIssues(snapshot); // revert the UI to exactly what it was
      toast.error(getErrorMessage(err, 'Move was rejected'));
    } finally { setMoving(null); }
  };

  const hasFilters = Object.values(filters).some(Boolean) || search;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="max-h-[45dvh] shrink-0 space-y-4 overflow-y-auto sm:max-h-none sm:overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Kanban board</h1><p className="text-sm text-slate-500">Drag cards between columns to update their status</p></div>
        <Link to="/issues/new" className="btn-primary"><Plus size={16} /> New issue</Link>
      </div>

      <div className="w-full max-w-sm"><SearchBar value={search} onSearch={onSearch} placeholder="Search the board…" /></div>
      <FilterPanel filters={filters} onChange={update} onClear={() => setParams(new URLSearchParams())} projects={projects} people={people} show={FILTER_KEYS} />
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="space-y-2"><ErrorMessage message={error} /><button type="button" className="btn-secondary" onClick={load}>Try again</button></div>}
      {!loading && !error && issues.length === 0 && (
        <EmptyState icon={KanbanSquare} title={hasFilters ? 'No issues match your filters' : 'The board is empty'} message={hasFilters ? 'Try clearing some filters.' : 'Issues reported in your projects will show up here.'} />
      )}

      {!loading && !error && issues.length > 0 && (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="min-h-0 w-full min-w-0 flex-1 snap-x snap-proximity overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]" data-testid="board">
          <div className="flex min-h-full w-max min-w-full gap-4 pb-2">
            {STATUSES.map((status) => {
              const droppable = draggingFrom && (status === draggingFrom.status || draggingFrom.capabilities?.allowedTransitions?.includes(status));
              const dim = draggingFrom && !droppable;
              return (
                <section key={status} aria-label={`${status} column`} className={`flex w-[17rem] shrink-0 snap-start flex-col sm:w-72 rounded-xl border border-t-4 border-slate-200 bg-slate-100/70 ${COLUMN_TONE[status]} ${dim ? 'opacity-50' : ''}`}>
                  <header className="flex items-center justify-between px-3 py-2.5"><h2 className="text-sm font-semibold text-slate-700">{status}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{columns[status].length}</span></header>
                  <Droppable droppableId={status} isDropDisabled={Boolean(draggingFrom) && !droppable}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} className={`min-h-[8rem] flex-1 space-y-2 rounded-b-xl p-2 transition ${snap.isDraggingOver ? 'bg-brand-50' : ''}`}>
                        {columns[status].map((issue, index) => {
                          const movable = (issue.capabilities?.allowedTransitions?.length || 0) > 0;
                          return (
                            <Draggable key={issue._id} draggableId={issue._id} index={index} isDragDisabled={!movable || moving === issue._id}>
                              {(p, s) => (
                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={`${movable ? 'cursor-grab' : 'cursor-default'} ${moving === issue._id ? 'opacity-60' : ''}`} title={movable ? undefined : 'You cannot move this issue'}>
                                  <IssueCard issue={issue} dragging={s.isDragging} />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {prov.placeholder}
                        {columns[status].length === 0 && !snap.isDraggingOver && <p className="py-6 text-center text-xs text-slate-400">No issues</p>}
                      </div>
                    )}
                  </Droppable>
                </section>
              );
            })}
          </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
