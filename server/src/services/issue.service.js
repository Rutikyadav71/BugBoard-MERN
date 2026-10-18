import mongoose from 'mongoose';
import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import { AppError } from '../utils/AppError.js';
import { ROLES } from '../utils/constants.js';
import { checkTransition, nextStatuses, projectAccessFilter, isProjectMember } from '../utils/permissions.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const populateIssue = (q) =>
  q
    .populate('project', 'name key')
    .populate('reporter', 'name email role')
    .populate('assignee', 'name email role');

// Activity rows are written ONLY from here (server-side); there is no public endpoint to create them.
const logActivity = (issue, user, action, from = null, to = null) =>
  Activity.create({ issue, user: user._id, action, from: from == null ? null : String(from), to: to == null ? null : String(to) });

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------
async function accessibleProjectIds(user) {
  const projects = await Project.find(projectAccessFilter(user)).select('_id');
  return projects.map((p) => p._id);
}

// Loads an issue only if the user can see its project. 404 hides the existence of other teams' issues.
export async function getAccessibleIssue(user, id) {
  const issue = await populateIssue(Issue.findById(id));
  if (!issue) throw AppError.notFound('Issue not found');
  const project = await Project.findById(issue.project._id).select('members createdBy');
  if (!project || !isProjectMember(project, user._id)) throw AppError.notFound('Issue not found');
  return { issue, project };
}

// Assignee must be an active Developer who is a member of the project.
async function assertValidAssignee(project, assigneeId) {
  const assignee = await User.findOne({ _id: assigneeId, isActive: true }).select('role');
  if (!assignee) throw AppError.unprocessable('Assignee does not exist', [{ field: 'assignee', message: 'Unknown user' }]);
  if (assignee.role !== ROLES.DEVELOPER) {
    throw AppError.unprocessable('Issues can only be assigned to Developers', [{ field: 'assignee', message: `${assignee.role}s cannot be assignees` }]);
  }
  if (!isProjectMember(project, assignee._id)) {
    throw AppError.unprocessable('Assignee must be a member of the project', [{ field: 'assignee', message: 'User is not a project member' }]);
  }
  return assignee;
}

// What may this user do to this issue? Used by both the API (enforcement) and the UI (button visibility).
export function capabilities(user, issue) {
  const isAdmin = user.role === ROLES.ADMIN;
  const isAssignee = issue.assignee && String(issue.assignee._id || issue.assignee) === String(user._id);
  const isReporter = String(issue.reporter._id || issue.reporter) === String(user._id);
  const statusRole = user.role;
  let transitions = nextStatuses(issue.status, statusRole);
  // A Developer may only progress issues assigned to them.
  if (user.role === ROLES.DEVELOPER && !isAssignee) transitions = [];
  return {
    canEdit: isAdmin || user.role === ROLES.TESTER || (user.role === ROLES.DEVELOPER && isAssignee),
    canAssign: isAdmin,
    canDelete: isAdmin || (user.role === ROLES.TESTER && isReporter && issue.status === 'Open'),
    allowedTransitions: transitions,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createIssue(user, input) {
  // Admins, Developers and Testers may all report issues, but only inside projects they belong to.
  // The reporter is always the authenticated user; a reporter/status sent by the client is stripped by validation.
  const project = await Project.findById(input.project).select('members createdBy key');
  if (!project || !isProjectMember(project, user._id)) throw AppError.notFound('Project not found');

  if (input.assignee) {
    if (user.role !== ROLES.ADMIN) throw AppError.forbidden('Only Admins can assign issues');
    await assertValidAssignee(project, input.assignee);
  }

  // Per-project counter gives sequential keys (ALP-1, ALP-2 ...). The `key` field has a unique index
  // as the final safety net, so if two requests ever race to the same number, the loser simply
  // takes the next number and retries instead of failing.
  let issue;
  for (let attempt = 0; attempt < 5 && !issue; attempt++) {
    const counter = await Project.findOneAndUpdate({ _id: project._id }, { $inc: { issueCounter: 1 } }, { new: true });
    const number = counter.issueCounter;
    try {
      issue = await Issue.create({
        key: `${project.key}-${number}`,
        number,
        title: input.title,
        description: input.description,
        project: project._id,
        severity: input.severity,
        priority: input.priority,
        category: input.category,
        component: input.component,
        dueDate: input.dueDate ?? null,
        status: 'Open',
        reporter: user._id, // never taken from the request body
        assignee: input.assignee || null,
      });
    } catch (err) {
      if (err?.code !== 11000 || attempt === 4) throw err;
    }
  }

  await logActivity(issue._id, user, 'issue_created', null, 'Open');
  if (input.assignee) await logActivity(issue._id, user, 'assignee_changed', null, input.assignee);

  const { issue: full } = await getAccessibleIssue(user, issue._id);
  return full;
}

// ---------------------------------------------------------------------------
// Read / list
// ---------------------------------------------------------------------------
const SORT_FIELD = { priority: 'priorityRank', severity: 'severityRank', status: 'statusRank' };

export async function listIssues(user, q) {
  const projectIds = await accessibleProjectIds(user);
  const filter = { project: { $in: projectIds } };

  if (q.project) {
    // Filtering by a project the user cannot see simply yields no rows (never leaks data).
    filter.project = projectIds.some((id) => String(id) === q.project) ? new mongoose.Types.ObjectId(q.project) : { $in: [] };
  }
  if (q.status) filter.status = { $in: q.status };
  if (q.priority) filter.priority = { $in: q.priority };
  if (q.severity) filter.severity = { $in: q.severity };
  if (q.reporter) filter.reporter = new mongoose.Types.ObjectId(q.reporter);
  if (q.assignee) {
    if (q.assignee === 'unassigned') filter.assignee = null;
    else filter.assignee = q.assignee === 'me' ? user._id : new mongoose.Types.ObjectId(q.assignee);
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { key: rx }];
  }

  const dir = q.order === 'asc' ? 1 : -1;
  const skip = (q.page - 1) * q.limit;
  const total = await Issue.countDocuments(filter);

  // Enum fields sort by their logical rank (Low < Medium < High ...) via the stored numeric rank.
  const sortField = SORT_FIELD[q.sortBy] || q.sortBy;
  // Tie-breakers keep pagination stable, but must not overwrite the primary sort key
  // (e.g. sortBy=createdAt must keep the requested direction).
  const sort = { [sortField]: dir };
  if (sortField !== 'createdAt') sort.createdAt = -1;
  sort._id = -1;
  const items = await populateIssue(Issue.find(filter).sort(sort).skip(skip).limit(q.limit));

  return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) };
}

export async function getIssue(user, id) {
  const { issue } = await getAccessibleIssue(user, id);
  return { ...issue.toJSON(), capabilities: capabilities(user, issue) };
}

// ---------------------------------------------------------------------------
// Update content fields
// ---------------------------------------------------------------------------
export async function updateIssue(user, id, patch) {
  const { issue } = await getAccessibleIssue(user, id);
  const caps = capabilities(user, issue);
  if (!caps.canEdit) throw AppError.forbidden('You do not have permission to edit this issue');

  const ACTIONS = {
    title: 'title_changed', description: 'description_changed', severity: 'severity_changed', priority: 'priority_changed',
    category: 'category_changed', component: 'component_changed', dueDate: 'due_date_changed',
  };
  // Dates are compared (and logged) as YYYY-MM-DD so re-saving the same day is not a change.
  const norm = (field, v) => (field === 'dueDate' ? (v ? new Date(v).toISOString().slice(0, 10) : null) : v);
  const changes = [];
  for (const [field, value] of Object.entries(patch)) {
    if (norm(field, issue[field]) !== norm(field, value)) {
      changes.push({ field, from: norm(field, issue[field]), to: norm(field, value) });
      issue[field] = value;
    }
  }
  if (!changes.length) return getIssue(user, id);

  await issue.save();
  for (const c of changes) {
    // Long free text is not stored in the timeline; the action alone is recorded.
    const long = c.field === 'description';
    await logActivity(issue._id, user, ACTIONS[c.field], long ? null : c.from, long ? null : c.to);
  }
  return getIssue(user, id);
}

// ---------------------------------------------------------------------------
// Status workflow
// ---------------------------------------------------------------------------
export async function updateStatus(user, id, status) {
  const { issue } = await getAccessibleIssue(user, id);

  if (user.role === ROLES.DEVELOPER) {
    const isAssignee = issue.assignee && String(issue.assignee._id) === String(user._id);
    if (!isAssignee) throw AppError.forbidden('Developers can only change the status of issues assigned to them');
  }

  const check = checkTransition(issue.status, status, user.role);
  if (!check.ok) throw check.forbidden ? AppError.forbidden(check.reason) : AppError.badRequest(check.reason);

  // A fix cannot go to Testing without someone owning it.
  if (status === 'In Progress' && issue.status === 'Open' && !issue.assignee) {
    throw AppError.badRequest('Assign the issue to a Developer before starting work on it');
  }

  const from = issue.status;
  issue.status = status;
  await issue.save();
  await logActivity(issue._id, user, 'status_changed', from, status);
  return getIssue(user, id);
}

// ---------------------------------------------------------------------------
// Assignment (Admin only)
// ---------------------------------------------------------------------------
export async function assignIssue(user, id, assigneeId) {
  if (user.role !== ROLES.ADMIN) throw AppError.forbidden('Only Admins can assign issues');
  const { issue, project } = await getAccessibleIssue(user, id);

  if (['Resolved', 'Closed'].includes(issue.status)) {
    throw AppError.badRequest(`Cannot reassign an issue that is ${issue.status}`);
  }
  if (assigneeId) await assertValidAssignee(project, assigneeId);

  const fromId = issue.assignee ? String(issue.assignee._id) : null;
  if (fromId === (assigneeId ? String(assigneeId) : null)) return getIssue(user, id);

  const label = async (uid) => (uid ? (await User.findById(uid).select('name'))?.name || String(uid) : 'Unassigned');
  const [fromName, toName] = await Promise.all([label(fromId), label(assigneeId)]);

  issue.assignee = assigneeId || null;
  await issue.save();
  await logActivity(issue._id, user, 'assignee_changed', fromName, toName);
  return getIssue(user, id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteIssue(user, id) {
  const { issue } = await getAccessibleIssue(user, id);
  if (!capabilities(user, issue).canDelete) {
    throw AppError.forbidden('You do not have permission to delete this issue');
  }
  await Promise.all([Comment.deleteMany({ issue: issue._id }), Activity.deleteMany({ issue: issue._id })]);
  await issue.deleteOne();
}

// ---------------------------------------------------------------------------
// Comments & activity
// ---------------------------------------------------------------------------
export async function addComment(user, issueId, text) {
  const { issue } = await getAccessibleIssue(user, issueId);
  const comment = await Comment.create({ issue: issue._id, author: user._id, text });
  return Comment.findById(comment._id).populate('author', 'name email role');
}

export async function listComments(user, issueId) {
  const { issue } = await getAccessibleIssue(user, issueId);
  return Comment.find({ issue: issue._id }).sort({ createdAt: 1 }).populate('author', 'name email role');
}

export async function listActivity(user, issueId) {
  const { issue } = await getAccessibleIssue(user, issueId);
  return Activity.find({ issue: issue._id }).sort({ createdAt: 1 }).populate('user', 'name email role');
}
