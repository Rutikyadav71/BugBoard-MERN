import { pathToFileURL } from 'node:url';
import { assertEnv } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Issue from '../models/Issue.js';
import Comment from '../models/Comment.js';
import Activity from '../models/Activity.js';
import { users, projects, issues, DEMO_PASSWORD } from './seedData.js';

// 'dev1@bugboard.local' -> 'dev1' (the short alias used in seedData.js)
const aliasOf = (email) => email.split('@')[0];
const arg = (name) => process.argv.includes(name);

// Idempotent: users and projects are matched by email / key, issues by their title within the project.
// Re-running never creates duplicates. Use --reset to wipe BugBoard collections first.
export async function seed({ reset = false, log = console.log } = {}) {
  if (reset) {
    await Promise.all([User.deleteMany({}), Project.deleteMany({}), Issue.deleteMany({}), Comment.deleteMany({}), Activity.deleteMany({})]);
    log('Existing data cleared (--reset).');
  }

  const byAlias = {};
  for (const u of users) {
    let doc = await User.findOne({ email: u.email });
    if (!doc) {
      doc = await User.create({ ...u, password: DEMO_PASSWORD }); // hashed by the model hook
      log(`+ user ${u.email} (${u.role})`);
    }
    byAlias[aliasOf(u.email)] = doc;
  }
  const admin = byAlias.admin;

  const projectByKey = {};
  for (const p of projects) {
    let doc = await Project.findOne({ key: p.key });
    if (!doc) {
      doc = await Project.create({
        key: p.key, name: p.name, description: p.description, createdBy: admin._id,
        members: p.members.map((a) => byAlias[a]._id),
      });
      log(`+ project ${p.key}`);
    }
    projectByKey[p.key] = doc;
  }

  for (const spec of issues) {
    const project = projectByKey[spec.project];
    if (await Issue.exists({ project: project._id, title: spec.title })) continue;

    const counter = await Project.findOneAndUpdate({ _id: project._id }, { $inc: { issueCounter: 1 } }, { new: true });
    const reporter = byAlias[spec.reporter];
    const assignee = spec.assignee ? byAlias[spec.assignee] : null;
    const finalStatus = spec.history.at(-1) || 'Open';

    const issue = await Issue.create({
      key: `${project.key}-${counter.issueCounter}`, number: counter.issueCounter,
      title: spec.title, description: spec.description, project: project._id,
      severity: spec.severity, priority: spec.priority, status: finalStatus,
      reporter: reporter._id, assignee: assignee?._id || null,
    });

    // Activity mirrors what the API would have recorded, with realistic actors per step.
    const acts = [{ user: reporter, action: 'issue_created', from: null, to: 'Open' }];
    if (assignee) acts.push({ user: admin, action: 'assignee_changed', from: 'Unassigned', to: assignee.name });
    let prev = 'Open';
    for (const step of spec.history) {
      const actor = ['In Progress', 'Testing'].includes(step) ? assignee : reporter;
      acts.push({ user: actor, action: 'status_changed', from: prev, to: step });
      prev = step;
    }
    // Sequential timestamps so the timeline order is deterministic.
    const base = Date.now() - 1000 * 60 * 60 * 24;
    for (const [i, a] of acts.entries()) {
      await Activity.create({ issue: issue._id, user: a.user._id, action: a.action, from: a.from, to: a.to, createdAt: new Date(base + i * 60000) });
    }
    for (const [i, [who, text]] of spec.comments.entries()) {
      await Comment.create({ issue: issue._id, author: byAlias[who]._id, text, createdAt: new Date(base + (acts.length + i) * 60000) });
    }
    log(`+ issue ${issue.key} [${finalStatus}] ${spec.title}`);
  }

  return { users: await User.countDocuments(), projects: await Project.countDocuments(), issues: await Issue.countDocuments() };
}

// Run directly: `npm run seed` (or `npm run seed -- --reset`). Importing this file (e.g. from tests) does not run it.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  (async () => {
    try {
      assertEnv();
      await connectDB();
      const totals = await seed({ reset: arg('--reset') });
      console.log(`\nDone. Database now has ${totals.users} users, ${totals.projects} projects, ${totals.issues} issues.`);
      console.log(`Demo logins (password for all: ${DEMO_PASSWORD})`);
      users.forEach((u) => console.log(`  ${u.role.padEnd(9)} ${u.email}`));
    } catch (err) {
      console.error('Seed failed:', err.message);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}
