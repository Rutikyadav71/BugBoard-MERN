import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.js';
import api, { TOKEN_KEY } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `initializing` is true until we have tried to restore a saved session, so protected
  // routes do not flash the login page on refresh.
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore session after a page refresh.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let active = true;
    authApi
      .me()
      .then((u) => active && setUser(u))
      .catch(() => active && clearSession())
      .finally(() => active && setInitializing(false));
    return () => { active = false; };
  }, [clearSession]);

  // If any API call comes back 401 (expired/invalid token), drop the session.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        const url = err?.config?.url || '';
        const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
        if (err?.response?.status === 401 && !isAuthAttempt && localStorage.getItem(TOKEN_KEY)) clearSession();
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [clearSession]);

  const persist = ({ user: u, token }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  };

  const login = useCallback(async (credentials) => persist(await authApi.login(credentials)), []);
  const register = useCallback(async (payload) => persist(await authApi.register(payload)), []);
  const logout = useCallback(() => clearSession(), [clearSession]);

  const value = useMemo(
    () => ({ user, initializing, isAuthenticated: Boolean(user), login, register, logout }),
    [user, initializing, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
