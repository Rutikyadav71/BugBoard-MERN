import api from './client.js';

export const aiApi = {
  status: () => api.get('/ai/status').then((r) => r.data.data),
  triage: (payload) => api.post('/ai/triage', payload).then((r) => r.data.data),
  improve: (payload) => api.post('/ai/improve', payload).then((r) => r.data.data),
  // Local similarity search: needs no AI key and uses no AI quota.
  similar: (payload) => api.post('/issues/similar', payload).then((r) => ({ items: r.data.data, meta: r.data.meta })),
};
