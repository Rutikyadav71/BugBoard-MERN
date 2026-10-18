import { app, request, makeUser, authed } from './helpers.js';

export const api = (method, path, token, body) => {
  const r = request(app)[method](`/api/v1${path}`).set(authed(token));
  return body === undefined ? r : r.send(body);
};

// admin + dev + dev2 + tester are members of project ALP; `outsider` (Developer) belongs to no project.
export async function makeTeam(projectKey = 'ALP') {
  const admin = await makeUser({ role: 'Admin', name: 'Ada Admin' });
  const dev = await makeUser({ role: 'Developer', name: 'Dan Dev' });
  const dev2 = await makeUser({ role: 'Developer', name: 'Dee Dev' });
  const tester = await makeUser({ role: 'Tester', name: 'Tia Tester' });
  const outsider = await makeUser({ role: 'Developer', name: 'Out Sider' });
  const members = [dev, dev2, tester].map((u) => String(u.user._id));
  const proj = (await api('post', '/projects', admin.token, { name: 'Alpha', key: projectKey, members })).body.data;
  return { admin, dev, dev2, tester, outsider, proj };
}

// Reported by the tester unless `who` says otherwise.
export const makeIssue = (t, over = {}, who = 'tester') =>
  api('post', '/issues', t[who].token, { title: 'Login button broken', description: 'Clicking does nothing', project: t.proj._id, ...over });

export const assign = (t, issueId, user) =>
  api('patch', `/issues/${issueId}/assign`, t.admin.token, { assignee: user ? String(user.user._id) : null });
