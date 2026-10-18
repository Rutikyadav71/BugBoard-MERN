import Issue from '../models/Issue.js';
import { rankSimilar } from '../ai/similarity.js';
import { getAccessibleProject } from './project.service.js';

const num = (v, d, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : d;
};

// Compares a draft against issues of ONE project the caller belongs to (getAccessibleProject answers 404
// otherwise). Candidates are limited to the most recent issues so one request stays cheap.
export async function findSimilarIssues(user, { project, title, description, excludeIssueId, limit }) {
  await getAccessibleProject(user, project);

  const threshold = num(process.env.DUPLICATE_MIN_SCORE, 0.25);
  const maxResults = Math.min(limit || num(process.env.DUPLICATE_MAX_RESULTS, 5, 1), 10);
  const candidateLimit = num(process.env.DUPLICATE_CANDIDATE_LIMIT, 1000, 10);

  const filter = { project, ...(excludeIssueId ? { _id: { $ne: excludeIssueId } } : {}) };
  const candidates = await Issue.find(filter)
    .sort({ createdAt: -1 })
    .limit(candidateLimit)
    .select('key title description status severity priority createdAt')
    .lean();

  const ranked = rankSimilar({ title, description }, candidates, { threshold, limit: maxResults });
  return {
    items: ranked.map((r) => ({
      issueId: String(r.doc._id),
      key: r.doc.key,
      title: r.doc.title,
      status: r.doc.status,
      severity: r.doc.severity,
      priority: r.doc.priority,
      snippet: String(r.doc.description || '').replace(/\s+/g, ' ').slice(0, 160),
      score: r.score,
      label: r.label,
      matchedTerms: r.matchedTerms,
    })),
    meta: { method: 'tf-idf', compared: candidates.length, threshold, note: 'Similarity of wording only. Review the issue before deciding it is a duplicate.' },
  };
}
