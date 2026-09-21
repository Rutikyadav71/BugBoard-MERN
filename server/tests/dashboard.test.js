import { app, request, setupDb, clearDb, teardownDb, authed } from './helpers.js';
import { seed } from '../src/seed/seed.js';
import User from '../src/models/User.js';
import Project from '../src/models/Project.js';
import Issue from '../src/models/Issue.js';
import Comment from '../src/models/Comment.js';
import Activity from '../src/models/Activity.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const login = async (email) =>
  (await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' })).body.data.token;
const get = (path, token) => request(app).get(`/api/v1${path}`).set(authed(token));

describe('seed script', () => {
  it('creates the documented demo data with valid relationships', async () => {
    const totals = await seed({ log: () => {} });
    expect(totals).toEqual({ users: 5, projects: 2, issues: 8 });
    const roles = (await User.find()).map((u) => u.role).sort();
    expect(roles).toEqual(['Admin', 'Developer', 'Developer', 'Tester', 'Tester']);
    expect(await Comment.countDocuments()).toBeGreaterThan(0);
    expect(await Activity.countDocuments()).toBeGreaterThan(8);

    // every reporter/assignee must be a member of the issue's project, and assignees are Developers
    const projects = new Map((await Project.find()).map((p) => [String(p._id), p]));
    const users = new Map((await User.find()).map((u) => [String(u._id), u]));
    for (const i of await Issue.find()) {
      const members = projects.get(String(i.project)).members.map(String);
      expect(members).toContain(String(i.reporter));
      if (i.assignee) {
        expect(members).toContain(String(i.assignee));
        expect(users.get(String(i.assignee)).role).toBe('Developer');
      }
    }
  });

  it('is safe to re-run: no duplicates', async () => {
    await seed({ log: () => {} });
    const commentsBefore = await Comment.countDocuments();
    const activityBefore = await Activity.countDocuments();
    const again = await seed({ log: () => {} });
    expect(again).toEqual({ users: 5, projects: 2, issues: 8 });
    expect(await Comment.countDocuments()).toBe(commentsBefore);
    expect(await Activity.countDocuments()).toBe(activityBefore);
    const keys = (await Issue.find()).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stores hashed passwords and the demo accounts can log in', async () => {
    await seed({ log: () => {} });
    const stored = await User.findOne({ email: 'admin@bugboard.local' }).select('+password');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    for (const e of ['admin', 'dev1', 'dev2', 'tester1', 'tester2']) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: `${e}@bugboard.local`, password: 'Password123' });
      expect(res.status).toBe(200);
    }
  });

  it('--reset semantics: reseeding after wipe restores the same totals', async () => {
    await seed({ log: () => {} });
    const totals = await seed({ reset: true, log: () => {} });
    expect(totals).toEqual({ users: 5, projects: 2, issues: 8 });
  });
});

describe('GET /dashboard/stats', () => {
  beforeEach(async () => { await seed({ log: () => {} }); });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/dashboard/stats')).status).toBe(401);
    expect((await request(app).get('/api/v1/dashboard/assigned')).status).toBe(401);
  });

  it('Admin sees real totals from the database with zero-filled distributions', async () => {
    const res = await get('/dashboard/stats', await login('admin@bugboard.local'));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.summary).toMatchObject({ total: 8, open: 3, inProgress: 2, testing: 1, resolved: 1, closed: 1, critical: 2 });
    expect(d.byStatus.map((s) => s.name)).toEqual(['Open', 'In Progress', 'Testing', 'Resolved', 'Closed']);
    expect(d.byStatus.reduce((n, s) => n + s.value, 0)).toBe(8);
    expect(d.byPriority.map((s) => s.name)).toEqual(['Low', 'Medium', 'High', 'Urgent']);
    expect(d.byPriority.reduce((n, s) => n + s.value, 0)).toBe(8);
    expect(d.projects.map((p) => p.key).sort()).toEqual(['MOB', 'WEB']);
    expect(d.recentIssues).toHaveLength(5);
    expect(d.recentlyUpdated).toHaveLength(5);
  });

  it('numbers change when the data changes (nothing is hardcoded)', async () => {
    const t = await login('admin@bugboard.local');
    const before = (await get('/dashboard/stats', t)).body.data.summary.total;
    const proj = (await get('/projects', t)).body.data.find((p) => p.key === 'WEB');
    await request(app).post('/api/v1/issues').set(authed(t)).send({ title: 'Brand new bug', description: 'added during test', project: proj._id, severity: 'Critical' });
    const after = (await get('/dashboard/stats', t)).body.data.summary;
    expect(after.total).toBe(before + 1);
    expect(after.critical).toBe(3);
  });

  it('a Developer only sees their projects and their own assigned count', async () => {
    const dev2 = (await get('/dashboard/stats', await login('dev2@bugboard.local'))).body.data;
    expect(dev2.projects.map((p) => p.key)).toEqual(['WEB']);
    expect(dev2.summary.total).toBe(5);
    expect(dev2.summary.assignedToMe).toBe(1); // WEB-3 Testing (WEB-5 is Closed)
    const dev1 = (await get('/dashboard/stats', await login('dev1@bugboard.local'))).body.data;
    expect(dev1.summary.assignedToMe).toBe(3);
  });

  it('a Tester sees issues they reported', async () => {
    const t1 = (await get('/dashboard/stats', await login('tester1@bugboard.local'))).body.data;
    expect(t1.summary.reportedByMe).toBe(6);
    const t2 = (await get('/dashboard/stats', await login('tester2@bugboard.local'))).body.data;
    expect(t2.summary.reportedByMe).toBe(2);
  });

  it('project filter narrows the numbers', async () => {
    const t = await login('admin@bugboard.local');
    const mob = (await get('/projects', t)).body.data.find((p) => p.key === 'MOB');
    const d = (await get(`/dashboard/stats?project=${mob._id}`, t)).body.data;
    expect(d.summary.total).toBe(3);
    expect(d.selectedProject).toBe(mob._id);
    expect(d.projects).toHaveLength(2); // dropdown still lists everything
  });

  it('SECURITY: filtering by a project you cannot access yields an empty scope, not its data', async () => {
    const admin = await login('admin@bugboard.local');
    const mob = (await get('/projects', admin)).body.data.find((p) => p.key === 'MOB');
    const d = (await get(`/dashboard/stats?project=${mob._id}`, await login('dev2@bugboard.local'))).body.data;
    expect(d.summary.total).toBe(0);
    expect(d.selectedProject).toBeNull();
    expect(d.recentIssues).toHaveLength(0);
  });

  it('rejects a malformed project id with 422', async () => {
    expect((await get('/dashboard/stats?project=nope', await login('admin@bugboard.local'))).status).toBe(422);
  });

  it('never leaks password hashes', async () => {
    const res = await get('/dashboard/stats', await login('admin@bugboard.local'));
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });
});

describe('GET /dashboard/assigned', () => {
  beforeEach(async () => { await seed({ log: () => {} }); });

  it('lists only the caller\'s active assigned issues, highest priority first', async () => {
    const res = await get('/dashboard/assigned', await login('dev1@bugboard.local'));
    expect(res.status).toBe(200);
    expect(res.body.data.map((i) => i.key)).toEqual(['MOB-1', 'WEB-1', 'MOB-3']);
    expect(res.body.data.every((i) => i.assignee.name === 'Dan Developer')).toBe(true);
    // resolved/closed work is excluded (dev1 owns WEB-4 which is Resolved)
    expect(res.body.data.find((i) => i.key === 'WEB-4')).toBeUndefined();
  });

  it('is empty for users with nothing assigned', async () => {
    expect((await get('/dashboard/assigned', await login('tester1@bugboard.local'))).body.data).toEqual([]);
  });
});
