export const STATUSES = ['Open', 'In Progress', 'Testing', 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export const STATUS_STYLES = {
  Open: 'bg-slate-100 text-slate-700 ring-slate-300',
  'In Progress': 'bg-blue-100 text-blue-700 ring-blue-300',
  Testing: 'bg-amber-100 text-amber-800 ring-amber-300',
  Resolved: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  Closed: 'bg-zinc-200 text-zinc-600 ring-zinc-300',
};
export const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-600 ring-slate-300',
  Medium: 'bg-sky-100 text-sky-700 ring-sky-300',
  High: 'bg-orange-100 text-orange-700 ring-orange-300',
  Urgent: 'bg-red-100 text-red-700 ring-red-300',
};
export const SEVERITY_STYLES = {
  Low: 'bg-slate-100 text-slate-600 ring-slate-300',
  Medium: 'bg-yellow-100 text-yellow-800 ring-yellow-300',
  High: 'bg-orange-100 text-orange-700 ring-orange-300',
  Critical: 'bg-red-600 text-white ring-red-700',
};
export const CHART_COLORS = {
  status: { Open: '#94a3b8', 'In Progress': '#3b82f6', Testing: '#f59e0b', Resolved: '#10b981', Closed: '#71717a' },
  priority: { Low: '#94a3b8', Medium: '#38bdf8', High: '#fb923c', Urgent: '#ef4444' },
};

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-');
export const formatDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
  }
  return 'just now';
}

// Human readable text for an activity row.
export function describeActivity(a) {
  switch (a.action) {
    case 'issue_created': return 'created this issue';
    case 'status_changed': return `changed status from ${a.from} to ${a.to}`;
    case 'assignee_changed': return `changed assignee from ${a.from} to ${a.to}`;
    case 'priority_changed': return `changed priority from ${a.from} to ${a.to}`;
    case 'severity_changed': return `changed severity from ${a.from} to ${a.to}`;
    case 'title_changed': return `renamed the issue from "${a.from}" to "${a.to}"`;
    case 'description_changed': return 'updated the description';
    default: return 'updated the issue';
  }
}
