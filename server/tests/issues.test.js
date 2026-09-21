import { app, request, setupDb, clearDb, teardownDb, makeUser, authed } from './helpers.js';
import Issue from '../src/models/Issue.js';
import Activity from '../src/models/Activity.js';
import Project from '../src/models/Project.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const api = (method, path, token, body) => {
  const r = request(app)[method](`/api/v1${path}`).set(authed(token));
  return body === undefined ? r : r.send(body);
};

// Team: admin + dev + dev2 + tester in project ALP; outsider(dev) and other project OTH.
async function team() {
  const admin = await makeUser({ role: 'Admin', name: 'Ada Admin' });
  const dev = await makeUser({ role: 'Developer', name: 'Dan Dev' });
  const dev2 = await makeUser({ role: 'Developer', name: 'Dee Dev' });
  const tester = await makeUser({ role: 'Tester', name: 'Tia Tester' });
  const outsider = await makeUser({ role: 'Developer', name: 'Out Sider' });
  const testerOut = await makeUser({ role: 'Tester', name: 'Out Tester' });
  const ids = [dev, dev2, tester].map((u) => String(u.user._id));
  const proj = (await api('post', '/projects', admin.token, { name: 'Alpha', key: 'ALP', members: ids })).body.data;
  const other = (await api('post', '/projects', admin.token, { name: 'Other', key: 'OTH' })).body.data;
  return { admin, dev, dev2, tester, outsider, testerOut, proj, other };
}

const newIssue = (t, over = {}) =>
  api('post', '/issues', t.tester.token, { title: 'Login button broken', description: 'Clicking does nothing', project: t.proj._id, ...over });

describe('issue creation', () => {
  it('Tester creates an issue: reporter is the caller, status Open, key ALP-1', async () => {
    const t = await team();
    const res = await newIssue(t, { severity: 'High', priority: 'Urgent' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ key: 'ALP-1', status: 'Open', severity: 'High', priority: 'Urgent' });
    expect(res.body.data.reporter._id).toBe(String(t.tester.user._id));
    expect(res.body.data.assignee).toBeNull();
  });

  it('SECURITY: ignores client-supplied reporter and status', async () => {
    const t = await team();
    const res = await newIssue(t, { reporter: String(t.admin.user._id), status: 'Closed' });
    expect(res.status).toBe(201);
    expect(res.body.data.reporter._id).toBe(String(t.tester.user._id));
    expect(res.body.data.status).toBe('Open');
  });

  it('Admin, Developer and Tester can all report issues in their project', async () => {
    const t = await team();
    for (const who of ['admin', 'dev', 'tester']) {
      const res = await api('post', '/issues', t[who].token, { title: `${who} bug`, description: `reported by ${who}`, project: t.proj._id });
      expect(res.status).toBe(201);
      expect(res.body.data.reporter._id).toBe(String(t[who].user._id));
      expect(res.body.data.status).toBe('Open');
    }
  });

  it('SECURITY: a Developer cannot spoof the reporter, status or assignee when reporting', async () => {
    const t = await team();
    const res = await api('post', '/issues', t.dev.token, {
      title: 'Dev bug', description: 'from a developer', project: t.proj._id,
      reporter: String(t.admin.user._id), status: 'Closed', role: 'Admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.reporter._id).toBe(String(t.dev.user._id));
    expect(res.body.data.status).toBe('Open');
    expect(res.body.data.assignee).toBeNull();
  });

  it('a Developer cannot assign while reporting (Admin only)', async () => {
    const t = await team();
    const res = await api('post', '/issues', t.dev.token, { title: 'Dev bug', description: 'from a developer', project: t.proj._id, assignee: String(t.dev2.user._id) });
    expect(res.status).toBe(403);
    expect(await Issue.countDocuments()).toBe(0);
  });

  it('a Developer cannot report in a project they are not a member of (404)', async () => {
    const t = await team();
    const res = await api('post', '/issues', t.dev.token, { title: 'Dev bug', description: 'wrong project', project: t.other._id });
    expect(res.status).toBe(404);
    expect(await Issue.countDocuments()).toBe(0);
  });

  it('keys increment per project and are unique under concurrency', async () => {
    const t = await team();
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => newIssue(t, { title: `Concurrent ${i}` })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const keys = results.map((r) => r.body.data.key);
    expect(new Set(keys).size).toBe(8);
    expect(keys.sort()).toEqual(Array.from({ length: 8 }, (_, i) => `ALP-${i + 1}`).sort());
    const o = await api('post', '/issues', t.admin.token, { title: 'Other proj', description: 'other project', project: t.other._id });
    expect(o.body.data.key).toBe('OTH-1');
  });

  it('cannot create in a project the user is not a member of (404)', async () => {
    const t = await team();
    const res = await api('post', '/issues', t.testerOut.token, { title: 'Sneaky bug', description: 'not my project', project: t.proj._id });
    expect(res.status).toBe(404);
    expect(await Issue.countDocuments()).toBe(0);
  });

  it('cannot reference a nonexistent project', async () => {
    const t = await team();
    const res = await api('post', '/issues', t.tester.token, { title: 'Ghost bug', description: 'no such project', project: '64b7f0f0f0f0f0f0f0f0f0f0' });
    expect(res.status).toBe(404);
  });

  it.each([
    ['short title', { title: 'ab' }],
    ['short description', { description: 'x' }],
    ['bad severity', { severity: 'Catastrophic' }],
    ['bad priority', { priority: 'Whenever' }],
    ['malformed project', { project: 'abc' }],
  ])('validation: %s -> 422', async (_l, over) => {
    const t = await team();
    expect((await newIssue(t, over)).status).toBe(422);
  });

  it('only Admin can assign at creation; assignee must be a member Developer', async () => {
    const t = await team();
    expect((await newIssue(t, { assignee: String(t.dev.user._id) })).status).toBe(403);
    const ok = await api('post', '/issues', t.admin.token, { title: 'Assigned bug', description: 'has an owner', project: t.proj._id, assignee: String(t.dev.user._id) });
    expect(ok.status).toBe(201);
    expect(ok.body.data.assignee._id).toBe(String(t.dev.user._id));
    const bad = await api('post', '/issues', t.admin.token, { title: 'Bad assign', description: 'outsider owner', project: t.proj._id, assignee: String(t.outsider.user._id) });
    expect(bad.status).toBe(422);
  });
});

describe('issue visibility (cross-project isolation)', () => {
  it('outsiders get 404 on read, update, status, comment and delete', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    const o = t.outsider.token;
    expect((await api('get', `/issues/${id}`, o)).status).toBe(404);
    expect((await api('patch', `/issues/${id}`, o, { title: 'hacked!' })).status).toBe(404);
    expect((await api('patch', `/issues/${id}/status`, o, { status: 'In Progress' })).status).toBe(404);
    expect((await api('post', `/issues/${id}/comments`, o, { text: 'hi' })).status).toBe(404);
    expect((await api('get', `/issues/${id}/comments`, o)).status).toBe(404);
    expect((await api('get', `/issues/${id}/activity`, o)).status).toBe(404);
    expect((await api('delete', `/issues/${id}`, o)).status).toBe(404);
    expect((await Issue.findById(id)).title).toBe('Login button broken');
  });

  it('lists only issues from accessible projects, and ignores a foreign project filter', async () => {
    const t = await team();
    await newIssue(t);
    await api('post', '/issues', t.admin.token, { title: 'Other proj bug', description: 'in OTH', project: t.other._id });
    const dev = await api('get', '/issues', t.dev.token);
    expect(dev.body.data).toHaveLength(1);
    const probe = await api('get', `/issues?project=${t.other._id}`, t.dev.token);
    expect(probe.status).toBe(200);
    expect(probe.body.data).toHaveLength(0);
    expect((await api('get', '/issues', t.outsider.token)).body.data).toHaveLength(0);
  });
});

describe('status workflow', () => {
  async function assigned(t) {
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    return id;
  }
  const status = (id, token, s) => api('patch', `/issues/${id}/status`, token, { status: s });

  it('full happy path: Open -> In Progress -> Testing -> Resolved -> Closed', async () => {
    const t = await team();
    const id = await assigned(t);
    expect((await status(id, t.dev.token, 'In Progress')).body.data.status).toBe('In Progress');
    expect((await status(id, t.dev.token, 'Testing')).body.data.status).toBe('Testing');
    expect((await status(id, t.tester.token, 'Resolved')).body.data.status).toBe('Resolved');
    expect((await status(id, t.tester.token, 'Closed')).body.data.status).toBe('Closed');
  });

  it('rejects skipping steps and backwards jumps with a helpful 400', async () => {
    const t = await team();
    const id = await assigned(t);
    const skip = await status(id, t.admin.token, 'Resolved');
    expect(skip.status).toBe(400);
    expect(skip.body.message).toMatch(/Invalid status transition: 'Open' -> 'Resolved'.*Allowed next statuses: In Progress/);
    expect((await status(id, t.admin.token, 'Open')).status).toBe(400); // same status
  });

  it('rejects an unknown status with 422', async () => {
    const t = await team();
    const id = await assigned(t);
    expect((await status(id, t.admin.token, 'Done')).status).toBe(422);
  });

  it('roles: developer cannot verify/close; tester cannot start work', async () => {
    const t = await team();
    const id = await assigned(t);
    expect((await status(id, t.tester.token, 'In Progress')).status).toBe(403);
    await status(id, t.dev.token, 'In Progress');
    await status(id, t.dev.token, 'Testing');
    expect((await status(id, t.dev.token, 'Resolved')).status).toBe(403);
    expect((await Issue.findById(id)).status).toBe('Testing');
  });

  it('a Developer can only move issues assigned to THEM', async () => {
    const t = await team();
    const id = await assigned(t); // assigned to dev
    expect((await status(id, t.dev2.token, 'In Progress')).status).toBe(403);
    expect((await status(id, t.dev.token, 'In Progress')).status).toBe(200);
  });

  it('cannot start work on an unassigned issue', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    const res = await status(id, t.admin.token, 'In Progress');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Assign the issue/);
  });

  it('a Tester can reject a fix (Testing -> In Progress) and reopen a regression', async () => {
    const t = await team();
    const id = await assigned(t);
    await status(id, t.dev.token, 'In Progress');
    await status(id, t.dev.token, 'Testing');
    expect((await status(id, t.tester.token, 'In Progress')).status).toBe(200);
    await status(id, t.dev.token, 'Testing');
    await status(id, t.tester.token, 'Resolved');
    expect((await status(id, t.tester.token, 'In Progress')).status).toBe(200);
  });

  it('Closed is terminal except Admin reopen', async () => {
    const t = await team();
    const id = await assigned(t);
    await status(id, t.dev.token, 'In Progress');
    await status(id, t.dev.token, 'Testing');
    await status(id, t.tester.token, 'Resolved');
    await status(id, t.tester.token, 'Closed');
    expect((await status(id, t.tester.token, 'Open')).status).toBe(403);
    expect((await status(id, t.admin.token, 'In Progress')).status).toBe(400);
    expect((await status(id, t.admin.token, 'Open')).status).toBe(200);
  });

  it('exposes allowed transitions per role in the issue payload', async () => {
    const t = await team();
    const id = await assigned(t);
    expect((await api('get', `/issues/${id}`, t.dev.token)).body.data.capabilities.allowedTransitions).toEqual(['In Progress']);
    expect((await api('get', `/issues/${id}`, t.dev2.token)).body.data.capabilities.allowedTransitions).toEqual([]);
    expect((await api('get', `/issues/${id}`, t.tester.token)).body.data.capabilities.allowedTransitions).toEqual([]);
  });
});

describe('assignment', () => {
  it('Admin assigns, reassigns and unassigns; activity records names', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) })).body.data.assignee.name).toBe('Dan Dev');
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev2.user._id) })).body.data.assignee.name).toBe('Dee Dev');
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: null })).body.data.assignee).toBeNull();
    const acts = (await api('get', `/issues/${id}/activity`, t.admin.token)).body.data.filter((a) => a.action === 'assignee_changed');
    expect(acts.map((a) => [a.from, a.to])).toEqual([['Unassigned', 'Dan Dev'], ['Dan Dev', 'Dee Dev'], ['Dee Dev', 'Unassigned']]);
  });

  it.each(['dev', 'tester'])('%s cannot assign (403)', async (who) => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    expect((await api('patch', `/issues/${id}/assign`, t[who].token, { assignee: String(t.dev.user._id) })).status).toBe(403);
  });

  it('assignee must be a member AND a Developer', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.outsider.user._id) })).status).toBe(422); // not a member
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.tester.user._id) })).status).toBe(422); // wrong role
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: '64b7f0f0f0f0f0f0f0f0f0f0' })).status).toBe(422); // missing
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: 'zzz' })).status).toBe(422); // malformed
  });

  it('cannot reassign a resolved issue', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    for (const [tok, s] of [[t.dev.token, 'In Progress'], [t.dev.token, 'Testing'], [t.tester.token, 'Resolved']]) {
      await api('patch', `/issues/${id}/status`, tok, { status: s });
    }
    expect((await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev2.user._id) })).status).toBe(400);
  });

  it('cannot remove a member who still has active assigned issues', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    const res = await api('patch', `/projects/${t.proj._id}/members`, t.admin.token, { remove: [String(t.dev.user._id)] });
    expect(res.status).toBe(409);
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: null });
    expect((await api('patch', `/projects/${t.proj._id}/members`, t.admin.token, { remove: [String(t.dev.user._id)] })).status).toBe(200);
  });
});

describe('editing and deleting', () => {
  it('Tester and Admin can edit; assignee Developer can edit; other Developer cannot', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    expect((await api('patch', `/issues/${id}`, t.tester.token, { priority: 'Low' })).body.data.priority).toBe('Low');
    expect((await api('patch', `/issues/${id}`, t.dev.token, { severity: 'Critical' })).body.data.severity).toBe('Critical');
    expect((await api('patch', `/issues/${id}`, t.dev2.token, { severity: 'Low' })).status).toBe(403);
  });

  it('PATCH cannot smuggle in status/assignee/reporter/project', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    const res = await api('patch', `/issues/${id}`, t.admin.token, { title: 'Renamed bug', status: 'Closed', assignee: String(t.dev.user._id), reporter: String(t.admin.user._id), project: t.other._id });
    expect(res.status).toBe(200);
    const doc = await Issue.findById(id);
    expect(doc.title).toBe('Renamed bug');
    expect(doc.status).toBe('Open');
    expect(doc.assignee).toBeNull();
    expect(String(doc.reporter)).toBe(String(t.tester.user._id));
    expect(String(doc.project)).toBe(t.proj._id);
  });

  it('empty update is rejected', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    expect((await api('patch', `/issues/${id}`, t.admin.token, {})).status).toBe(422);
  });

  it('Admin can delete (with comments and activity cascaded); developer cannot', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('post', `/issues/${id}/comments`, t.tester.token, { text: 'note' });
    expect((await api('delete', `/issues/${id}`, t.dev.token)).status).toBe(403);
    expect((await api('delete', `/issues/${id}`, t.admin.token)).status).toBe(200);
    expect(await Issue.countDocuments()).toBe(0);
    expect(await Activity.countDocuments({ issue: id })).toBe(0);
    expect((await api('get', `/issues/${id}`, t.admin.token)).status).toBe(404);
  });

  it('a Tester may delete only their own issue while still Open', async () => {
    const t = await team();
    const mine = (await newIssue(t)).body.data._id;
    const theirs = (await api('post', '/issues', t.admin.token, { title: 'Admin issue', description: 'not the tester\'s', project: t.proj._id })).body.data._id;
    expect((await api('delete', `/issues/${theirs}`, t.tester.token)).status).toBe(403);
    expect((await api('delete', `/issues/${mine}`, t.tester.token)).status).toBe(200);
  });
});

describe('comments and activity', () => {
  it('members can comment; comments are chronological with author', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    const c1 = await api('post', `/issues/${id}/comments`, t.tester.token, { text: 'First' });
    expect(c1.status).toBe(201);
    expect(c1.body.data.author.name).toBe('Tia Tester');
    await new Promise((r) => setTimeout(r, 15));
    await api('post', `/issues/${id}/comments`, t.dev.token, { text: 'Second' });
    const list = await api('get', `/issues/${id}/comments`, t.admin.token);
    expect(list.body.data.map((c) => c.text)).toEqual(['First', 'Second']);
  });

  it('rejects empty / whitespace / oversized comments', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    expect((await api('post', `/issues/${id}/comments`, t.tester.token, { text: '' })).status).toBe(422);
    expect((await api('post', `/issues/${id}/comments`, t.tester.token, { text: '    ' })).status).toBe(422);
    expect((await api('post', `/issues/${id}/comments`, t.tester.token, { text: 'x'.repeat(2001) })).status).toBe(422);
    expect((await api('post', `/issues/${id}/comments`, t.tester.token, {})).status).toBe(422);
  });

  it('SECURITY: comment author cannot be forged', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    const res = await api('post', `/issues/${id}/comments`, t.tester.token, { text: 'hi', author: String(t.admin.user._id) });
    expect(res.body.data.author._id).toBe(String(t.tester.user._id));
  });

  it('activity timeline is written by the server as things change', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    await api('patch', `/issues/${id}`, t.tester.token, { priority: 'Urgent', severity: 'Critical' });
    await api('patch', `/issues/${id}/status`, t.dev.token, { status: 'In Progress' });
    const acts = (await api('get', `/issues/${id}/activity`, t.admin.token)).body.data;
    const pairs = acts.map((a) => `${a.action}:${a.from}>${a.to}`);
    expect(pairs).toEqual(expect.arrayContaining([
      'issue_created:null>Open', 'assignee_changed:Unassigned>Dan Dev',
      'priority_changed:Medium>Urgent', 'severity_changed:Medium>Critical', 'status_changed:Open>In Progress',
    ]));
    expect(acts.every((a) => a.user.name)).toBe(true);
  });

  it('SECURITY: there is no endpoint to forge activity', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    for (const method of ['post', 'put', 'patch', 'delete']) {
      expect((await api(method, `/issues/${id}/activity`, t.admin.token, { action: 'status_changed' })).status).toBe(404);
    }
  });

  it('failed transitions leave no activity record', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/status`, t.admin.token, { status: 'Closed' });
    expect(await Activity.countDocuments({ issue: id, action: 'status_changed' })).toBe(0);
  });
});

describe('list: search, filters, sorting, pagination', () => {
  async function seed(t) {
    const specs = [
      ['Crash on checkout', 'Payment page crashes', 'Critical', 'Urgent'],
      ['Typo in footer', 'Spelling mistake', 'Low', 'Low'],
      ['Slow search results', 'Search is slow', 'Medium', 'High'],
      ['Login fails on Safari', 'Cannot log in', 'High', 'High'],
    ];
    const ids = [];
    for (const [title, description, severity, priority] of specs) {
      ids.push((await newIssue(t, { title, description, severity, priority })).body.data._id);
      await new Promise((r) => setTimeout(r, 5));
    }
    await api('patch', `/issues/${ids[0]}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    await api('patch', `/issues/${ids[0]}/status`, t.dev.token, { status: 'In Progress' });
    return ids;
  }
  const titles = (res) => res.body.data.map((i) => i.title);

  it('search matches title, description and key; is case-insensitive and regex-safe', async () => {
    const t = await team(); await seed(t);
    expect(titles(await api('get', '/issues?search=CHECKOUT', t.admin.token))).toEqual(['Crash on checkout']);
    expect(titles(await api('get', '/issues?search=spelling', t.admin.token))).toEqual(['Typo in footer']);
    expect(titles(await api('get', '/issues?search=alp-2', t.admin.token))).toEqual(['Typo in footer']);
    const weird = await api('get', '/issues?search=' + encodeURIComponent('.*(['), t.admin.token);
    expect(weird.status).toBe(200);
    expect(weird.body.data).toHaveLength(0);
  });

  it('filters by status, priority, severity (single and comma-separated)', async () => {
    const t = await team(); await seed(t);
    expect(titles(await api('get', '/issues?status=In Progress', t.admin.token))).toEqual(['Crash on checkout']);
    expect((await api('get', '/issues?priority=High', t.admin.token)).body.data).toHaveLength(2);
    expect((await api('get', '/issues?priority=High,Urgent', t.admin.token)).body.data).toHaveLength(3);
    expect(titles(await api('get', '/issues?severity=Critical', t.admin.token))).toEqual(['Crash on checkout']);
    expect((await api('get', '/issues?status=Bogus', t.admin.token)).status).toBe(422);
  });

  it('filters by reporter, project and assignee (id, me, unassigned)', async () => {
    const t = await team(); await seed(t);
    expect((await api('get', `/issues?reporter=${t.tester.user._id}`, t.admin.token)).body.data).toHaveLength(4);
    expect((await api('get', `/issues?reporter=${t.admin.user._id}`, t.admin.token)).body.data).toHaveLength(0);
    expect((await api('get', `/issues?project=${t.proj._id}`, t.admin.token)).body.data).toHaveLength(4);
    expect(titles(await api('get', `/issues?assignee=${t.dev.user._id}`, t.admin.token))).toEqual(['Crash on checkout']);
    expect(titles(await api('get', '/issues?assignee=me', t.dev.token))).toEqual(['Crash on checkout']);
    expect((await api('get', '/issues?assignee=unassigned', t.admin.token)).body.data).toHaveLength(3);
    expect((await api('get', '/issues?assignee=me', t.dev2.token)).body.data).toHaveLength(0);
  });

  it('sorts by priority/severity by LOGICAL rank, not alphabetically', async () => {
    const t = await team(); await seed(t);
    expect(titles(await api('get', '/issues?sortBy=severity&order=desc', t.admin.token))).toEqual(
      ['Crash on checkout', 'Login fails on Safari', 'Slow search results', 'Typo in footer']);
    expect(titles(await api('get', '/issues?sortBy=priority&order=asc', t.admin.token))[0]).toBe('Typo in footer');
    expect(titles(await api('get', '/issues?sortBy=priority&order=desc', t.admin.token))[0]).toBe('Crash on checkout');
  });

  it('sorts by title and createdAt', async () => {
    const t = await team(); await seed(t);
    expect(titles(await api('get', '/issues?sortBy=title&order=asc', t.admin.token))[0]).toBe('Crash on checkout');
    expect(titles(await api('get', '/issues?sortBy=createdAt&order=asc', t.admin.token))[0]).toBe('Crash on checkout');
    expect(titles(await api('get', '/issues?sortBy=createdAt&order=desc', t.admin.token))[0]).toBe('Login fails on Safari');
  });

  it('paginates with correct meta and no overlap', async () => {
    const t = await team(); await seed(t);
    const p1 = await api('get', '/issues?limit=3&page=1&sortBy=title&order=asc', t.admin.token);
    const p2 = await api('get', '/issues?limit=3&page=2&sortBy=title&order=asc', t.admin.token);
    expect(p1.body.data).toHaveLength(3);
    expect(p2.body.data).toHaveLength(1);
    expect(p1.body.meta).toMatchObject({ total: 4, pages: 2, page: 1, limit: 3 });
    const all = [...titles(p1), ...titles(p2)];
    expect(new Set(all).size).toBe(4);
    // enum-sorted pagination must also be stable
    const s1 = await api('get', '/issues?limit=2&page=1&sortBy=priority&order=desc', t.admin.token);
    const s2 = await api('get', '/issues?limit=2&page=2&sortBy=priority&order=desc', t.admin.token);
    expect(new Set([...titles(s1), ...titles(s2)]).size).toBe(4);
  });

  it('rejects invalid pagination and sort params (422)', async () => {
    const t = await team();
    for (const q of ['page=0', 'limit=1000', 'limit=abc', 'sortBy=password', 'order=sideways']) {
      expect((await api('get', `/issues?${q}`, t.admin.token)).status).toBe(422);
    }
  });

  it('populated rows never expose password hashes', async () => {
    const t = await team(); await seed(t);
    const res = await api('get', '/issues', t.admin.token);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });
});

describe('list capabilities (used by the Kanban board)', () => {
  it('each list row carries the caller-specific allowed transitions', async () => {
    const t = await team();
    const id = (await newIssue(t)).body.data._id;
    await api('patch', `/issues/${id}/assign`, t.admin.token, { assignee: String(t.dev.user._id) });
    const row = (token) => api('get', '/issues', token).then((r) => r.body.data.find((i) => i._id === id).capabilities);
    expect((await row(t.dev.token)).allowedTransitions).toEqual(['In Progress']);
    expect((await row(t.dev2.token)).allowedTransitions).toEqual([]);
    expect((await row(t.tester.token)).allowedTransitions).toEqual([]);
    expect((await row(t.admin.token)).allowedTransitions).toEqual(['In Progress']);
  });
});

describe('data integrity', () => {
  it('counter is stored on the project', async () => {
    const t = await team();
    await newIssue(t); await newIssue(t);
    expect((await Project.findById(t.proj._id)).issueCounter).toBe(2);
  });
});
