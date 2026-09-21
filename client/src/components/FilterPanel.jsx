import { X } from 'lucide-react';
import { STATUSES, PRIORITIES, SEVERITIES } from '../utils/constants.js';

const Select = ({ label, value, onChange, options, placeholder }) => {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="label text-xs">{label}</label>
      <select id={id} className="input min-w-0 py-1.5" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {/* A multi-value filter (e.g. "Open,In Progress,Testing" from a dashboard link) is not one option, so show it explicitly instead of pretending nothing is selected. */}
        {value && value.includes(',') && <option value={value}>{value.split(',').join(' / ')}</option>}
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
};

// `filters` is a plain object; `onChange(patch)` merges a change. Everything is optional so the
// same panel serves the issue list (all filters) and the Kanban board (fewer).
export default function FilterPanel({ filters, onChange, onClear, projects = [], people = [], show = ['project', 'status', 'priority', 'severity', 'assignee', 'reporter'] }) {
  const active = Object.entries(filters).some(([k, v]) => v && show.includes(k));
  const has = (k) => show.includes(k);
  return (
    <div className="card min-w-0 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {has('project') && <Select label="Project" value={filters.project} onChange={(v) => onChange({ project: v })} placeholder="All projects" options={projects.map((p) => ({ value: p._id, label: `${p.key} - ${p.name}` }))} />}
        {has('status') && <Select label="Status" value={filters.status} onChange={(v) => onChange({ status: v })} placeholder="Any status" options={STATUSES} />}
        {has('priority') && <Select label="Priority" value={filters.priority} onChange={(v) => onChange({ priority: v })} placeholder="Any priority" options={PRIORITIES} />}
        {has('severity') && <Select label="Severity" value={filters.severity} onChange={(v) => onChange({ severity: v })} placeholder="Any severity" options={SEVERITIES} />}
        {has('assignee') && <Select label="Assignee" value={filters.assignee} onChange={(v) => onChange({ assignee: v })} placeholder="Anyone" options={[{ value: 'me', label: 'Assigned to me' }, { value: 'unassigned', label: 'Unassigned' }, ...people.map((p) => ({ value: p._id, label: p.name }))]} />}
        {has('reporter') && <Select label="Reporter" value={filters.reporter} onChange={(v) => onChange({ reporter: v })} placeholder="Anyone" options={people.map((p) => ({ value: p._id, label: p.name }))} />}
      </div>
      {active && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700" onClick={onClear}><X size={14} /> Clear filters</button>
        </div>
      )}
    </div>
  );
}
