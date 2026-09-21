import api from './client.js';

export const issuesApi = {
  list: (params) => api.get('/issues', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),
  get: (id) => api.get(`/issues/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/issues', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/issues/${id}`, payload).then((r) => r.data.data),
  setStatus: (id, status) => api.patch(`/issues/${id}/status`, { status }).then((r) => r.data.data),
  assign: (id, assignee) => api.patch(`/issues/${id}/assign`, { assignee }).then((r) => r.data.data),
  remove: (id) => api.delete(`/issues/${id}`).then((r) => r.data.data),
  comments: (id) => api.get(`/issues/${id}/comments`).then((r) => r.data.data),
  addComment: (id, text) => api.post(`/issues/${id}/comments`, { text }).then((r) => r.data.data),
  activity: (id) => api.get(`/issues/${id}/activity`).then((r) => r.data.data),
};

export const dashboardApi = {
  stats: (params) => api.get('/dashboard/stats', { params }).then((r) => r.data.data),
  assigned: () => api.get('/dashboard/assigned').then((r) => r.data.data),
};
