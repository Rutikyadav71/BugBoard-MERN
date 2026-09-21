import { STATUS_STYLES, PRIORITY_STYLES, SEVERITY_STYLES } from '../utils/constants.js';

const base = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({ status }) {
  return <span className={`${base} ${STATUS_STYLES[status] || ''}`}>{status}</span>;
}
export function PriorityBadge({ priority }) {
  return <span className={`${base} ${PRIORITY_STYLES[priority] || ''}`}>{priority}</span>;
}
export function SeverityBadge({ severity }) {
  return <span className={`${base} ${SEVERITY_STYLES[severity] || ''}`}>{severity}</span>;
}
