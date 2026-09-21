import { useAuth } from '../context/AuthContext.jsx';
import RoleBadge from '../components/RoleBadge.jsx';

export default function ProfilePage() {
  const { user } = useAuth();
  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Member since', new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })],
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My profile</h1>
      <div className="card divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-6">
            <span className="text-sm text-slate-500">{k}</span>
            <span className="min-w-0 break-all text-sm font-medium text-slate-900">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-sm text-slate-500">Role</span>
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>
  );
}
