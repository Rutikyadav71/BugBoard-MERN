import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';
import { app, setupDb, clearDb, teardownDb, makeUser, authed } from './helpers.js';
import User from '../src/models/User.js';
import { createAuthLimiter } from '../src/middleware/rateLimiters.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const valid = { name: 'Alice Tester', email: 'alice@test.com', password: 'Password123' };

describe('POST /auth/register', () => {
  it('registers a user, returns a token, and never leaks the password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // no bcrypt hash anywhere
  });

  it('stores a bcrypt hash, not the plain password', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const stored = await User.findOne({ email: 'alice@test.com' }).select('+password');
    expect(stored.password).not.toBe(valid.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('defaults to Tester and allows choosing Developer', async () => {
    const a = await request(app).post('/api/v1/auth/register').send(valid);
    expect(a.body.data.user.role).toBe('Tester');
    const b = await request(app).post('/api/v1/auth/register').send({ ...valid, email: 'dev@test.com', accountType: 'Developer' });
    expect(b.body.data.user.role).toBe('Developer');
  });

  it('SECURITY: ignores a client-supplied "role: Admin" (no privilege escalation)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, role: 'Admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('Tester');
  });

  it('SECURITY: rejects accountType "Admin"', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, accountType: 'Admin' });
    expect(res.status).toBe(422);
    const count = await User.countDocuments();
    expect(count).toBe(0);
  });

  it('rejects duplicate emails with 409 (case-insensitive)', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, email: 'ALICE@test.com' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['short password', { password: 'Ab1' }],
    ['password without a number', { password: 'onlyletters' }],
    ['invalid email', { email: 'not-an-email' }],
    ['short name', { name: 'A' }],
  ])('validation: %s -> 422 with field errors', async (_label, patch) => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, ...patch });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => { await request(app).post('/api/v1/auth/register').send(valid); });

  it('logs in with correct credentials (email case-insensitive)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ALICE@test.com', password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: valid.email, password: 'WrongPass123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('gives the SAME message for an unknown email (no account enumeration)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects a deactivated account', async () => {
    await User.updateOne({ email: valid.email }, { isActive: false });
    const res = await request(app).post('/api/v1/auth/login').send({ email: valid.email, password: valid.password });
    expect(res.status).toBe(401);
  });

  it('validates missing fields with 422', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
  });
});

describe('GET /auth/me and protected routes', () => {
  it('returns the current user for a valid token', async () => {
    const { user, token } = await makeUser({ role: 'Developer' });
    const res = await request(app).get('/api/v1/auth/me').set(authed(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(String(user._id));
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('401 with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 with a malformed token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set(authed('garbage.token.value'));
    expect(res.status).toBe(401);
  });

  it('401 with a token signed by a different secret', async () => {
    const { user } = await makeUser();
    const forged = jwt.sign({ sub: String(user._id) }, 'some-other-secret');
    const res = await request(app).get('/api/v1/auth/me').set(authed(forged));
    expect(res.status).toBe(401);
  });

  it('401 with an expired token', async () => {
    const { user } = await makeUser();
    const expired = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/v1/auth/me').set(authed(expired));
    expect(res.status).toBe(401);
  });

  it('401 once the user is deactivated even with a still-valid token', async () => {
    const { user, token } = await makeUser();
    await User.updateOne({ _id: user._id }, { isActive: false });
    const res = await request(app).get('/api/v1/auth/me').set(authed(token));
    expect(res.status).toBe(401);
  });

  it('role always comes from the database, not the token', async () => {
    const { user } = await makeUser({ role: 'Tester' });
    const forged = jwt.sign({ sub: String(user._id), role: 'Admin' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/me').set(authed(forged));
    expect(res.body.data.user.role).toBe('Tester');
  });
});

describe('rate limiting', () => {
  it('blocks after too many attempts with 429', async () => {
    const mini = express();
    mini.use(createAuthLimiter({ max: 3, windowMs: 60_000 }));
    mini.post('/x', (_req, res) => res.json({ ok: true }));
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await request(mini).post('/x')).status);
    expect(results).toEqual([200, 200, 200, 429, 429]);
  });
});
