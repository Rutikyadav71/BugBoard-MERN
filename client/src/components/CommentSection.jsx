import { useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { issuesApi } from '../api/issues.js';
import { getErrorMessage } from '../api/client.js';
import { timeAgo, formatDateTime } from '../utils/constants.js';
import RoleBadge from './RoleBadge.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { useToast } from './Toast.jsx';

export default function CommentSection({ issueId, comments, onAdded }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) { setError('Comment cannot be empty'); return; }
    setSending(true); setError('');
    try {
      const c = await issuesApi.addComment(issueId, trimmed);
      setText('');
      onAdded(c);
      toast.success('Comment added');
    } catch (err) { setError(getErrorMessage(err, 'Could not add comment')); } finally { setSending(false); }
  };

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900"><MessageSquare size={18} /> Comments ({comments.length})</h2>
      {comments.length === 0 && <p className="mb-4 text-sm text-slate-500">No comments yet. Start the discussion below.</p>}
      <ul className="mb-5 space-y-4">
        {comments.map((c) => (
          <li key={c._id} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{c.author.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-900">{c.author.name}</span><RoleBadge role={c.author.role} /><time className="text-xs text-slate-400" dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</time></div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <ErrorMessage message={error} />
        <label htmlFor="comment" className="sr-only">Add a comment</label>
        <textarea id="comment" rows={3} className="input" placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={sending}><Send size={14} /> Comment</button></div>
      </form>
    </section>
  );
}
