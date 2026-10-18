import { app, request, setupDb, clearDb, teardownDb, authed } from './helpers.js';
import { api, makeTeam, makeIssue } from './teamHelpers.js';
import { tokenize, rankSimilar } from '../src/ai/similarity.js';
import { mockControls } from '../src/ai/providers/mockProvider.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => { await clearDb(); mockControls.reset(); });

const CORPUS = [
  { _id: 1, title: 'Login fails with 500 error on Safari', description: 'Users on Safari cannot sign in; the button does nothing.' },
  { _id: 2, title: 'Checkout page crashes on submit', description: 'Clicking Pay now throws a 500 error for saved cards.' },
  { _id: 3, title: 'Typo in footer copyright text', description: 'Footer says Copywrite instead of Copyright.' },
  { _id: 4, title: 'Search results are slow', description: 'Search takes over 5 seconds for common queries.' },
  { _id: 5, title: 'Broken link on pricing page', description: 'The Contact sales link returns 404.' },
];
const ids = (r) => r.map((x) => x.doc._id);

describe('tokenize', () => {
  it('lowercases, drops stop words and 1-letter tokens, and stems simple suffixes', () => {
    const out = tokenize('The Buttons are NOT working when clicking it, 500 errors!').map((t) => t.stem);
    expect(out).toEqual(['button', 'work', 'click', '500', 'error']); // 'working' and 'clicking' share the -ing rule
  });
  it('keeps the original word for display', () => {
    expect(tokenize('Searching')[0]).toEqual({ stem: 'search', word: 'searching' });
  });
  it('handles empty and non-string input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
  });
});

describe('rankSimilar', () => {
  it('ranks the genuinely related issue first and explains the match with shared words', () => {
    const r = rankSimilar({ title: 'Cannot login on Safari', description: 'sign in button does nothing in Safari' }, CORPUS);
    expect(r[0].doc._id).toBe(1);
    expect(r[0].matchedTerms).toEqual(expect.arrayContaining(['safari']));
    expect(r[0].score).toBeGreaterThan(0.4);
    expect(r[0].score).toBeLessThanOrEqual(1);
    expect(['Very similar', 'Similar']).toContain(r[0].label);
  });

  it('matches across word forms (searching/slow -> "Search results are slow")', () => {
    const r = rankSimilar({ title: 'Slow searching', description: 'searches take forever' }, CORPUS);
    expect(ids(r)).toContain(4);
    expect(r[0].doc._id).toBe(4);
  });

  it('returns nothing for an unrelated draft', () => {
    expect(rankSimilar({ title: 'Dark mode colours wrong in settings panel', description: '' }, CORPUS)).toEqual([]);
  });

  it('does not match on a single coincidental word', () => {
    const r = rankSimilar({ title: 'Footer animation stutters', description: 'scrolling lags badly on mobile' }, CORPUS);
    expect(ids(r)).not.toContain(3); // shares only "footer"
  });

  it('results are sorted by score, capped by limit, and filtered by threshold', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ _id: 10 + i, title: `Login fails on Safari variant ${i}`, description: 'sign in button does nothing' }));
    const q = { title: 'Login fails on Safari', description: 'sign in button does nothing' };
    const top3 = rankSimilar(q, many, { limit: 3 });
    expect(top3).toHaveLength(3);
    expect(top3.map((r) => r.score)).toEqual([...top3.map((r) => r.score)].sort((a, b) => b - a));
    expect(rankSimilar(q, many, { threshold: 0.9999 })).toEqual([]);
  });

  it('handles empty drafts and empty corpora without errors', () => {
    expect(rankSimilar({ title: '', description: '' }, CORPUS)).toEqual([]);
    expect(rankSimilar({ title: 'login safari', description: '' }, [])).toEqual([]);
    expect(rankSimilar({ title: 'the and of', description: 'is a' }, CORPUS)).toEqual([]); // only stop words
  });

  it('is deterministic', () => {
    const q = { title: 'Login Safari error', description: 'sign in fails' };
    expect(rankSimilar(q, CORPUS)).toEqual(rankSimilar(q, CORPUS));
  });
});

describe('POST /issues/similar', () => {
  async function seeded() {
    const t = await makeTeam('ALP');
    for (const [title, description] of [
      ['Login fails on Safari', 'Users on Safari cannot sign in; the button does nothing.'],
      ['Checkout page crashes on submit', 'Clicking Pay now throws a 500 error for saved cards.'],
      ['Search results are slow', 'Search takes over 5 seconds for common queries.'],
    ]) expect((await makeIssue(t, { title, description })).status).toBe(201);
    return t;
  }
  const similar = (t, token, body) => api('post', '/issues/similar', token, { project: t.proj._id, ...body });
  const draft = { title: 'Cannot login in Safari', description: 'the sign in button does nothing' };

  it('returns ranked similar issues with scores, status and a reason, for any project member', async () => {
    const t = await seeded();
    for (const who of ['tester', 'dev', 'admin']) {
      const res = await similar(t, t[who].token, draft);
      expect(res.status).toBe(200);
      const top = res.body.data[0];
      expect(top).toMatchObject({ key: 'ALP-1', title: 'Login fails on Safari', status: 'Open' });
      expect(top.score).toBeGreaterThan(0.25);
      expect(top.score).toBeLessThanOrEqual(1);
      expect(top.matchedTerms).toContain('safari');
      expect(top.snippet.length).toBeGreaterThan(0);
      expect(top.issueId).toMatch(/^[a-f0-9]{24}$/);
    }
    const res = await similar(t, t.tester.token, draft);
    expect(res.body.meta).toMatchObject({ method: 'tf-idf', compared: 3 });
    expect(res.body.meta.note).toMatch(/Review the issue/);
  });

  it('exposes only issue fields, never people or secrets', async () => {
    const t = await seeded();
    const row = (await similar(t, t.tester.token, draft)).body.data[0];
    expect(Object.keys(row).sort()).toEqual(['issueId', 'key', 'label', 'matchedTerms', 'priority', 'score', 'severity', 'snippet', 'status', 'title']);
  });

  it('SECURITY: only searches the given project; other projects are never read or returned', async () => {
    const t = await seeded();
    const other = (await api('post', '/projects', t.admin.token, { name: 'Other', key: 'OTH' })).body.data;
    await api('post', '/issues', t.admin.token, { title: 'Login fails on Safari badly', description: 'Safari sign in button does nothing', project: other._id });
    const res = await similar(t, t.admin.token, draft);
    expect(res.body.data.map((r) => r.key)).toEqual(['ALP-1']);
    expect(res.body.meta.compared).toBe(3);
    const inOther = await api('post', '/issues/similar', t.admin.token, { project: other._id, ...draft });
    expect(inOther.body.data.map((r) => r.key)).toEqual(['OTH-1']);
  });

  it('SECURITY: a non-member gets 404, learns nothing, and the AI provider is not involved', async () => {
    const t = await seeded();
    const res = await similar(t, t.outsider.token, draft);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/Safari/);
    expect(mockControls.calls).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const t = await seeded();
    expect((await request(app).post('/api/v1/issues/similar').send({ project: t.proj._id, ...draft })).status).toBe(401);
  });

  it('can exclude an issue (e.g. the one being viewed)', async () => {
    const t = await seeded();
    const list = (await api('get', '/issues?search=Safari', t.admin.token)).body.data;
    const res = await similar(t, t.admin.token, { ...draft, excludeIssueId: list[0]._id });
    expect(res.body.data.map((r) => r.key)).not.toContain('ALP-1');
  });

  it('returns an empty list for an empty or meaningless draft', async () => {
    const t = await seeded();
    for (const body of [{}, { title: '' }, { title: 'a' }, { title: 'the and of' }]) {
      const res = await similar(t, t.tester.token, body);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    }
  });

  it('honours DUPLICATE_MIN_SCORE and limit', async () => {
    const t = await seeded();
    process.env.DUPLICATE_MIN_SCORE = '0.99';
    try { expect((await similar(t, t.tester.token, draft)).body.data).toEqual([]); } finally { delete process.env.DUPLICATE_MIN_SCORE; }
    for (let i = 0; i < 3; i += 1) await makeIssue(t, { title: `Login fails on Safari again ${i}`, description: 'Safari sign in button does nothing' });
    const limited = await similar(t, t.tester.token, { ...draft, limit: 2 });
    expect(limited.body.data).toHaveLength(2);
  });

  it('rejects invalid input with 422', async () => {
    const t = await seeded();
    expect((await api('post', '/issues/similar', t.tester.token, { project: 'nope', ...draft })).status).toBe(422);
    expect((await similar(t, t.tester.token, { title: 'x'.repeat(201) })).status).toBe(422);
    expect((await similar(t, t.tester.token, { ...draft, limit: 11 })).status).toBe(422);
    expect((await api('post', '/issues/similar', t.tester.token, draft)).status).toBe(422); // project missing
  });

  it('works with AI switched off entirely and never calls the provider', async () => {
    const t = await seeded();
    process.env.AI_ENABLED = 'false';
    try {
      const res = await similar(t, t.tester.token, draft);
      expect(res.status).toBe(200);
      expect(res.body.data[0].key).toBe('ALP-1');
      expect(mockControls.calls).toHaveLength(0);
    } finally { process.env.AI_ENABLED = 'true'; }
  });

  it('still allows creating the issue (the feature only advises)', async () => {
    const t = await seeded();
    await similar(t, t.tester.token, draft);
    expect((await makeIssue(t, draft)).status).toBe(201);
  });
});
