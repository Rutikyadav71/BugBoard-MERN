import Project from '../models/Project.js';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import { AppError } from '../utils/AppError.js';
import { projectAccessFilter, isProjectMember } from '../utils/permissions.js';

const populateProject = (q) => q.populate('members', 'name email role').populate('createdBy', 'name email role');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Validates that every id is a real, active user. Prevents dangling references.
async function assertUsersExist(ids) {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return [];
  const users = await User.find({ _id: { $in: unique }, isActive: true }).select('_id role');
  if (users.length !== unique.length) {
    const found = new Set(users.map((u) => String(u._id)));
    const missing = unique.filter((id) => !found.has(id));
    throw AppError.unprocessable('Some users do not exist or are inactive', missing.map((id) => ({ field: 'members', message: `Unknown user: ${id}` })));
  }
  return users;
}

export async function createProject(user, { name, key, description, members }) {
  if (await Project.exists({ key })) throw AppError.conflict(`Project key '${key}' is already in use`);
  await assertUsersExist(members);

  // The creator is always a member so the project is never orphaned.
  const memberIds = [...new Set([String(user._id), ...members.map(String)])];
  const project = await Project.create({ name, key, description, members: memberIds, createdBy: user._id });
  return populateProject(Project.findById(project._id));
}

export async function listProjects(user, { search, page, limit }) {
  const filter = projectAccessFilter(user);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$and = [{ $or: [{ name: rx }, { key: rx }, { description: rx }] }];
  }
  const [items, total] = await Promise.all([
    populateProject(Project.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    Project.countDocuments(filter),
  ]);

  // Issue counts per project (total, and still-active) using two simple grouped counts,
  // which avoids N+1 queries and stays portable across MongoDB-compatible engines.
  const ids = items.map((p) => p._id);
  const stats = new Map(ids.map((id) => [String(id), { total: 0, open: 0 }]));
  if (ids.length) {
    const [totals, active] = await Promise.all([
      Issue.aggregate([{ $match: { project: { $in: ids } } }, { $group: { _id: '$project', n: { $sum: 1 } } }]),
      Issue.aggregate([
        { $match: { project: { $in: ids }, status: { $nin: ['Resolved', 'Closed'] } } },
        { $group: { _id: '$project', n: { $sum: 1 } } },
      ]),
    ]);
    totals.forEach((t) => { stats.get(String(t._id)).total = t.n; });
    active.forEach((a) => { stats.get(String(a._id)).open = a.n; });
  }
  const data = items.map((p) => ({ ...p.toJSON(), issueStats: stats.get(String(p._id)) || { total: 0, open: 0 } }));
  return { items: data, total, page, limit, pages: Math.ceil(total / limit) };
}

// Loads a project and enforces visibility. Returns 404 (not 403) for projects the user cannot see,
// so the existence of other teams' projects is not disclosed.
export async function getAccessibleProject(user, id) {
  const project = await populateProject(Project.findById(id));
  if (!project || !isProjectMember(project, user._id)) throw AppError.notFound('Project not found');
  return project;
}

export async function updateProject(user, id, patch) {
  const project = await getAccessibleProject(user, id);
  Object.assign(project, patch);
  await project.save();
  return populateProject(Project.findById(project._id));
}

export async function updateMembers(user, id, { add, remove }) {
  const project = await getAccessibleProject(user, id);
  const creatorId = String(project.createdBy._id);

  if (remove.map(String).includes(creatorId)) {
    throw AppError.badRequest('The project creator cannot be removed from the project');
  }
  await assertUsersExist(add);

  // Removing a member must not leave open issues assigned to someone who can no longer see them.
  if (remove.length) {
    const blocking = await Issue.countDocuments({
      project: project._id,
      assignee: { $in: remove },
      status: { $nin: ['Resolved', 'Closed'] },
    });
    if (blocking) {
      throw AppError.conflict(`Cannot remove members who still have ${blocking} active issue(s) assigned. Reassign those issues first.`);
    }
  }

  const current = new Set(project.members.map((m) => String(m._id)));
  add.map(String).forEach((id2) => current.add(id2));
  remove.map(String).forEach((id2) => current.delete(id2));
  project.members = [...current];
  await project.save();

  // Closed/resolved issues keep their historical assignee; only clear ones we just orphaned.
  return populateProject(Project.findById(project._id));
}

export async function listAssignableUsers(user, id) {
  const project = await getAccessibleProject(user, id);
  return project.members.filter((m) => m.role === 'Developer');
}

// Users that an Admin can pick from when building a team.
export async function listUsers({ search }) {
  const filter = { isActive: true };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  return User.find(filter).select('name email role').sort({ name: 1 }).limit(50);
}
