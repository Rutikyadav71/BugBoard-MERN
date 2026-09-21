import mongoose from 'mongoose';
import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import { STATUSES, PRIORITIES, SEVERITIES, ROLES } from '../utils/constants.js';
import { projectAccessFilter } from '../utils/permissions.js';

const populateIssue = (q) => q.populate('project', 'name key').populate('reporter', 'name').populate('assignee', 'name');

// Counts of one field, zero-filled so charts always show every category.
async function distribution(match, field, values) {
  const rows = await Issue.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return values.map((name) => ({ name, value: map.get(name) || 0 }));
}

// All dashboard numbers come from MongoDB and are scoped to projects the caller can access.
export async function getStats(user, { project } = {}) {
  const projects = await Project.find(projectAccessFilter(user)).select('name key').sort({ name: 1 });
  const ids = projects.map((p) => p._id);

  let scope = ids;
  if (project) scope = ids.filter((id) => String(id) === project); // foreign project -> empty scope
  const match = { project: { $in: scope } };

  const [byStatus, byPriority, bySeverity, recent, updated] = await Promise.all([
    distribution(match, 'status', STATUSES),
    distribution(match, 'priority', PRIORITIES),
    distribution(match, 'severity', SEVERITIES),
    populateIssue(Issue.find(match).sort({ createdAt: -1, _id: -1 }).limit(5)),
    populateIssue(Issue.find(match).sort({ updatedAt: -1, _id: -1 }).limit(5)),
  ]);

  const count = (name) => byStatus.find((s) => s.name === name)?.value || 0;
  const total = byStatus.reduce((n, s) => n + s.value, 0);
  const uid = new mongoose.Types.ObjectId(user._id);

  const [assignedToMe, reportedByMe, criticalActive] = await Promise.all([
    Issue.countDocuments({ ...match, assignee: uid, status: { $nin: ['Resolved', 'Closed'] } }),
    Issue.countDocuments({ ...match, reporter: uid }),
    Issue.countDocuments({ ...match, severity: 'Critical', status: { $nin: ['Resolved', 'Closed'] } }),
  ]);

  return {
    role: user.role,
    projects: projects.map((p) => ({ _id: p._id, name: p.name, key: p.key })),
    selectedProject: project && scope.length ? project : null,
    summary: {
      total,
      open: count('Open'),
      inProgress: count('In Progress'),
      testing: count('Testing'),
      resolved: count('Resolved'),
      closed: count('Closed'),
      critical: criticalActive,
      assignedToMe,
      reportedByMe,
    },
    byStatus,
    byPriority,
    bySeverity,
    recentIssues: recent,
    recentlyUpdated: updated,
  };
}

// The caller's own open work queue (used for Developers, but valid for anyone).
export async function getAssigned(user, { limit = 20 } = {}) {
  const ids = (await Project.find(projectAccessFilter(user)).select('_id')).map((p) => p._id);
  return populateIssue(
    Issue.find({ project: { $in: ids }, assignee: user._id, status: { $nin: ['Resolved', 'Closed'] } })
      .sort({ priorityRank: -1, updatedAt: -1, _id: -1 })
      .limit(limit)
  );
}

export { ROLES };
