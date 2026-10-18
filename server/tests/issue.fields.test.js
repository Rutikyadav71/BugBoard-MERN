import { setupDb, clearDb, teardownDb } from './helpers.js';
import { api, makeTeam, makeIssue, assign } from './teamHelpers.js';
import Issue from '../src/models/Issue.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const activity = async (t, id) => (await api('get', `/issues/${id}/activity`, t.admin.token)).body.data;

describe('category, component and due date', () => {
  it('default to Bug / empty / no due date when omitted (existing clients keep working)', async () => {
    const t = await makeTeam();
    const res = await makeIssue(t);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ category: 'Bug', component: '', dueDate: null });
  });

  it('can be set when reporting an issue', async () => {
    const t = await makeTeam();
    const res = await makeIssue(t, { category: 'Improvement', component: ' Checkout ', dueDate: '2026-12-31' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ category: 'Improvement', component: 'Checkout' });
    expect(res.body.data.dueDate).toBe('2026-12-31T00:00:00.000Z');
  });

  it.each([
    ['unknown category', { category: 'Epic' }],
    ['overlong component', { component: 'x'.repeat(81) }],
    ['malformed due date', { dueDate: '31/12/2026' }],
    ['impossible due date', { dueDate: '2026-13-45' }],
  ])('rejects %s with 422', async (_l, over) => {
    const t = await makeTeam();
    expect((await makeIssue(t, over)).status).toBe(422);
    expect(await Issue.countDocuments()).toBe(0);
  });

  it('can be edited and cleared, and each change is recorded in the activity timeline', async () => {
    const t = await makeTeam();
    const id = (await makeIssue(t)).body.data._id;
    const res = await api('patch', `/issues/${id}`, t.tester.token, { category: 'Feature', component: 'Search', dueDate: '2027-01-15' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ category: 'Feature', component: 'Search' });
    await api('patch', `/issues/${id}`, t.tester.token, { dueDate: null });
    expect((await api('get', `/issues/${id}`, t.tester.token)).body.data.dueDate).toBeNull();

    const pairs = (await activity(t, id)).map((a) => `${a.action}:${a.from}>${a.to}`);
    expect(pairs).toEqual(expect.arrayContaining([
      'category_changed:Bug>Feature', 'component_changed:>Search', 'due_date_changed:null>2027-01-15', 'due_date_changed:2027-01-15>null',
    ]));
  });

  it('re-saving the same value creates no activity entry', async () => {
    const t = await makeTeam();
    const id = (await makeIssue(t, { dueDate: '2027-01-15', component: 'Search' })).body.data._id;
    await api('patch', `/issues/${id}`, t.tester.token, { dueDate: '2027-01-15', component: 'Search', category: 'Bug' });
    const kinds = (await activity(t, id)).map((a) => a.action);
    expect(kinds).toEqual(['issue_created']);
  });

  it('follow the existing edit permissions: the assignee can edit, another developer cannot', async () => {
    const t = await makeTeam();
    const id = (await makeIssue(t)).body.data._id;
    await assign(t, id, t.dev);
    expect((await api('patch', `/issues/${id}`, t.dev.token, { component: 'API' })).status).toBe(200);
    expect((await api('patch', `/issues/${id}`, t.dev2.token, { component: 'Hacked' })).status).toBe(403);
    expect((await Issue.findById(id)).component).toBe('API');
  });

  it('SECURITY: unknown fields still cannot smuggle in status, reporter or project', async () => {
    const t = await makeTeam();
    const id = (await makeIssue(t)).body.data._id;
    await api('patch', `/issues/${id}`, t.admin.token, { component: 'Auth', status: 'Closed', reporter: String(t.admin.user._id) });
    const doc = await Issue.findById(id);
    expect(doc.component).toBe('Auth');
    expect(doc.status).toBe('Open');
    expect(String(doc.reporter)).toBe(String(t.tester.user._id));
  });
});
