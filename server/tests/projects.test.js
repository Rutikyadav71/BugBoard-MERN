import { app, request, setupDb, clearDb, teardownDb, makeUser, authed } from './helpers.js';
import Project from '../src/models/Project.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const post = (path, token, body) => request(app).post(`/api/v1${path}`).set(authed(token)).send(body);
const patch = (path, token, body) => request(app).patch(`/api/v1${path}`).set(authed(token)).send(body);
const get = (path, token) => request(app).get(`/api/v1${path}`).set(authed(token));

describe('project creation', () => {
  it('Admin can create a project and becomes a member', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const res = await post('/projects', admin.token, { name: 'Alpha', key: 'alp', description: 'first' });
    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('ALP'); // normalised to uppercase
    expect(res.body.data.members.map((m) => m._id)).toContain(String(admin.user._id));
    expect(res.body.data.createdBy._id).toBe(String(admin.user._id));
  });

  it.each(['Developer', 'Tester'])('%s CANNOT create a project (403)', async (role) => {
    const u = await makeUser({ role });
    const res = await post('/projects', u.token, { name: 'Nope', key: 'NOPE' });
    expect(res.status).toBe(403);
    expect(await Project.countDocuments()).toBe(0);
  });

  it('401 when unauthenticated', async () => {
    expect((await request(app).post('/api/v1/projects').send({ name: 'x', key: 'XX' })).status).toBe(401);
  });

  it('rejects a duplicate key with 409', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await post('/projects', admin.token, { name: 'Alpha', key: 'ALP' });
    const res = await post('/projects', admin.token, { name: 'Other', key: 'alp' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['key too short', { key: 'A' }],
    ['key starting with a digit', { key: '1ABC' }],
    ['key with symbols', { key: 'AB-C' }],
    ['name too short', { name: 'A' }],
    ['unknown member id', { members: ['64b7f0f0f0f0f0f0f0f0f0f0'] }],
    ['malformed member id', { members: ['nope'] }],
  ])('validation: %s', async (_l, patchBody) => {
    const admin = await makeUser({ role: 'Admin' });
    const res = await post('/projects', admin.token, { name: 'Alpha', key: 'ALP', ...patchBody });
    expect(res.status).toBe(422);
  });

  it('rejects inactive users as members', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const gone = await makeUser({ role: 'Developer', isActive: false });
    const res = await post('/projects', admin.token, { name: 'Alpha', key: 'ALP', members: [String(gone.user._id)] });
    expect(res.status).toBe(422);
  });
});

describe('project visibility (access restrictions)', () => {
  it('users only see projects they belong to; others 404 (existence not disclosed)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    const dev = await makeUser({ role: 'Developer' });
    const outsider = await makeUser({ role: 'Developer' });
    const created = await post('/projects', admin.token, { name: 'Alpha', key: 'ALP', members: [String(dev.user._id)] });
    const id = created.body.data._id;

    expect((await get('/projects', dev.token)).body.data).toHaveLength(1);
    expect((await get(`/projects/${id}`, dev.token)).status).toBe(200);

    expect((await get('/projects', outsider.token)).body.data).toHaveLength(0);
    expect((await get(`/projects/${id}`, outsider.token)).status).toBe(404);
  });

  it('an Admin does not see another Admin\'s project unless a member', async () => {
    const a1 = await makeUser({ role: 'Admin' });
    const a2 = await makeUser({ role: 'Admin' });
    const p = await post('/projects', a1.token, { name: 'Private', key: 'PRV' });
    expect((await get(`/projects/${p.body.data._id}`, a2.token)).status).toBe(404);
    expect((await get('/projects', a2.token)).body.data).toHaveLength(0);
  });

  it('rejects a malformed id with 422 rather than crashing', async () => {
    const admin = await makeUser({ role: 'Admin' });
    expect((await get('/projects/not-an-id', admin.token)).status).toBe(422);
  });

  it('supports search and pagination', async () => {
    const admin = await makeUser({ role: 'Admin' });
    for (const [n, k] of [['Website', 'WEB'], ['Mobile App', 'MOB'], ['Web API', 'API']]) {
      await post('/projects', admin.token, { name: n, key: k });
    }
    const s = await get('/projects?search=web', admin.token);
    expect(s.body.data.map((p) => p.key).sort()).toEqual(['API', 'WEB']);
    const pg = await get('/projects?limit=2&page=2', admin.token);
    expect(pg.body.data).toHaveLength(1);
    expect(pg.body.meta).toMatchObject({ total: 3, pages: 2, page: 2, limit: 2 });
  });

  it('search treats regex characters literally (no injection / crash)', async () => {
    const admin = await makeUser({ role: 'Admin' });
    await post('/projects', admin.token, { name: 'Alpha', key: 'ALP' });
    const res = await get('/projects?search=' + encodeURIComponent('.*(['), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('project update & membership', () => {
  let admin, dev, tester, projectId;
  beforeEach(async () => {
    admin = await makeUser({ role: 'Admin' });
    dev = await makeUser({ role: 'Developer' });
    tester = await makeUser({ role: 'Tester' });
    const p = await post('/projects', admin.token, { name: 'Alpha', key: 'ALP' });
    projectId = p.body.data._id;
  });

  it('Admin can update name/description but the key is immutable', async () => {
    const res = await patch(`/projects/${projectId}`, admin.token, { name: 'Renamed', key: 'HACK' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
    expect(res.body.data.key).toBe('ALP');
  });

  it('non-Admin cannot update (403)', async () => {
    await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id)] });
    expect((await patch(`/projects/${projectId}`, dev.token, { name: 'Hacked' })).status).toBe(403);
  });

  it('Admin can add and remove members', async () => {
    const add = await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id), String(tester.user._id)] });
    expect(add.status).toBe(200);
    expect(add.body.data.members).toHaveLength(3);
    const rem = await patch(`/projects/${projectId}/members`, admin.token, { remove: [String(tester.user._id)] });
    expect(rem.body.data.members.map((m) => m._id)).not.toContain(String(tester.user._id));
  });

  it('adding the same member twice does not duplicate', async () => {
    await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id)] });
    const again = await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id)] });
    expect(again.body.data.members).toHaveLength(2);
  });

  it('non-Admin cannot manage members (403)', async () => {
    await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id)] });
    expect((await patch(`/projects/${projectId}/members`, dev.token, { add: [String(tester.user._id)] })).status).toBe(403);
  });

  it('cannot add a nonexistent user (422)', async () => {
    const res = await patch(`/projects/${projectId}/members`, admin.token, { add: ['64b7f0f0f0f0f0f0f0f0f0f0'] });
    expect(res.status).toBe(422);
  });

  it('cannot remove the project creator (400)', async () => {
    const res = await patch(`/projects/${projectId}/members`, admin.token, { remove: [String(admin.user._id)] });
    expect(res.status).toBe(400);
  });

  it('an empty membership change is rejected', async () => {
    expect((await patch(`/projects/${projectId}/members`, admin.token, {})).status).toBe(422);
  });

  it('a removed member loses access immediately', async () => {
    await patch(`/projects/${projectId}/members`, admin.token, { add: [String(dev.user._id)] });
    expect((await get(`/projects/${projectId}`, dev.token)).status).toBe(200);
    await patch(`/projects/${projectId}/members`, admin.token, { remove: [String(dev.user._id)] });
    expect((await get(`/projects/${projectId}`, dev.token)).status).toBe(404);
  });

  it('user directory is Admin-only', async () => {
    expect((await get('/users', admin.token)).status).toBe(200);
    expect((await get('/users', dev.token)).status).toBe(403);
    const list = (await get('/users', admin.token)).body.data;
    expect(list[0].password).toBeUndefined();
  });
});
