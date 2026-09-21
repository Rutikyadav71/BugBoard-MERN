const STYLES = {
  Admin: 'bg-purple-100 text-purple-700 ring-purple-200',
  Developer: 'bg-sky-100 text-sky-700 ring-sky-200',
  Tester: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export default function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[role] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {role}
    </span>
  );
}
