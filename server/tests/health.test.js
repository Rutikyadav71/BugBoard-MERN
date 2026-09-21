import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

const app = createApp();

beforeAll(async () => { await connectDB(); });
afterAll(async () => { await disconnectDB(); });

describe('Foundation', () => {
  it('GET /api/v1/health reports ok and a connected database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe('connected');
  });

  it('returns a consistent 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
