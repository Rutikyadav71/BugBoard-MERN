import api from './client.js';

export const projectsApi = {
  list: (params) => api.get('/projects', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/projects', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/projects/${id}`, payload).then((r) => r.data.data),
  updateMembers: (id, payload) => api.patch(`/projects/${id}/members`, payload).then((r) => r.data.data),
  assignable: (id) => api.get(`/projects/${id}/assignable-users`).then((r) => r.data.data),
  users: (search) => api.get('/users', { params: { search } }).then((r) => r.data.data),
};
