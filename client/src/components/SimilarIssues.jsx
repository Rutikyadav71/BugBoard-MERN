import { useEffect, useState } from 'react';
import { ExternalLink, FileSearch, Loader2 } from 'lucide-react';
import { aiApi } from '../api/ai.js';
import { getErrorMessage } from '../api/client.js';
import { StatusBadge } from './Badges.jsx';

const MIN_TITLE_CHARS = 5;

// Shows existing issues in the same project whose wording resembles the draft. This is a text match, not a
// verdict: the reader decides whether it is the same problem. Runs locally on the server (no AI quota), so it
// keeps working when the AI provider is unavailable. Links open in a new tab so the draft is not lost.
export default function SimilarIssues({ projectId, title = '', description = '', delay = 600 }) {
  const [state, setState] = useState({ phase: 'idle', items: [], error: '' });

  useEffect(() => {
    const t = title.trim();
    if (!projectId || t.length < MIN_TITLE_CHARS) {
      setState({ phase: 'idle', items: [], error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, phase: 'loading', error: '' }));
    const id = setTimeout(async () => {
      try {
        const { items } = await aiApi.similar({ project: projectId, title: t, description: description.trim().slice(0, 5000) });
        if (!cancelled) setState({ phase: 'done', items, error: '' });
      } catch (err) {
        if (!cancelled) setState({ phase: 'error', items: [], error: getErrorMessage(err, 'Could not check for similar issues') });
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(id); };
  }, [projectId, title, description, delay]);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <FileSearch size={16} /> Similar existing issues
        {state.phase === 'loading' && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Checking" />}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Matches by wording only. Open one to check whether it is the same problem before creating a new issue.</p>

      <div aria-live="polite" className="mt-3">
        {state.phase === 'idle' && <p className="text-sm text-slate-400">Enter a title ({MIN_TITLE_CHARS}+ characters) to check for similar issues.</p>}
        {state.phase === 'error' && <p role="alert" className="text-sm text-amber-700">{state.error}. You can still submit the issue.</p>}
        {state.phase === 'done' && state.items.length === 0 && <p className="text-sm text-slate-500">No similar issues found in this project.</p>}
        {state.items.length > 0 && (
          <ul className="space-y-2">
            {state.items.map((m) => (
              <li key={m.issueId} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs text-slate-500">{m.key}</span>
                  <StatusBadge status={m.status} />
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700" title="Text similarity, not proof of a duplicate">
                    {m.label} · {Math.round(m.score * 100)}%
                  </span>
                  <a href={`/issues/${m.issueId}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                    Open <ExternalLink size={12} /><span className="sr-only"> {m.key} in a new tab</span>
                  </a>
                </div>
                <p className="mt-1 break-words text-sm font-medium text-slate-900">{m.title}</p>
                {m.snippet && <p className="mt-0.5 line-clamp-2 break-words text-xs text-slate-500">{m.snippet}</p>}
                {m.matchedTerms.length > 0 && <p className="mt-1 text-xs text-slate-400">Shared words: {m.matchedTerms.join(', ')}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
