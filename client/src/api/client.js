import axios from 'axios';

export const TOKEN_KEY = 'bugboard_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn any axios failure into a plain Error whose message is safe to show in the UI.
export function getErrorMessage(err, fallback = 'Something went wrong') {
  if (err?.response?.data?.errors?.length) {
    return err.response.data.errors.map((e) => e.message).join('. ');
  }
  return err?.response?.data?.message || (err?.request ? 'Cannot reach the server. Is the backend running?' : err?.message) || fallback;
}

export default api;
