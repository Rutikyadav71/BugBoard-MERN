import { History } from 'lucide-react';
import { describeActivity, timeAgo, formatDateTime } from '../utils/constants.js';

export default function ActivityTimeline({ items }) {
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900"><History size={18} /> Activity</h2>
      {items.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {items.map((a) => (
            <li key={a._id} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
              <p className="break-words text-sm text-slate-700"><span className="font-medium text-slate-900">{a.user?.name || 'Someone'}</span> {describeActivity(a)}</p>
              <time className="text-xs text-slate-400" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
