import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderApp, fakeUser } from './testUtils.jsx';
import { authApi } from './api/auth.js';
import { TOKEN_KEY } from './api/client.js';

vi.mock('./api/auth.js', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), me: vi.fn() },
}));
// The real dashboard loads its data from the API; unit tests must never hit the network.
vi.mock('./api/issues.js', () => ({
  dashboardApi: {
    stats: vi.fn().mockResolvedValue({
      role: 'Developer', projects: [], selectedProject: null,
      summary: { total: 0, open: 0, inProgress: 0, testing: 0, resolved: 0, closed: 0, critical: 0, assignedToMe: 0, reportedByMe: 0 },
      byStatus: [], byPriority: [], bySeverity: [], recentIssues: [], recentlyUpdated: [],
    }),
    assigned: vi.fn().mockResolvedValue([]),
  },
  issuesApi: {},
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('route protection', () => {
  it('redirects a signed-out visitor from /dashboard to /login', async () => {
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('sends "/" to login when signed out', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('restores the session from a saved token after refresh', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved.jwt');
    authApi.me.mockResolvedValue(fakeUser);
    renderApp('/dashboard');
    expect(await screen.findByText(/welcome back, dana/i)).toBeInTheDocument();
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });

  it('clears an invalid saved token and shows login', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale.jwt');
    authApi.me.mockRejectedValue({ response: { status: 401 } });
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('keeps signed-in users away from the login page', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved.jwt');
    authApi.me.mockResolvedValue(fakeUser);
    renderApp('/login');
    expect(await screen.findByText(/welcome back, dana/i)).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('shows validation errors and does not call the API for empty input', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('logs in, stores the token and lands on the dashboard', async () => {
    authApi.login.mockResolvedValue({ user: fakeUser, token: 'new.jwt' });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'dana@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/welcome back, dana/i)).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new.jwt');
    expect(authApi.login).toHaveBeenCalledWith({ email: 'dana@test.com', password: 'Password123' });
  });

  it('shows the server error for bad credentials', async () => {
    authApi.login.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid email or password' } } });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'dana@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('register form', () => {
  it('blocks mismatched passwords', async () => {
    renderApp('/register');
    await userEvent.type(await screen.findByLabelText('Full name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Email'), 'new@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Different123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('registers WITHOUT sending confirmPassword and never offers an Admin choice', async () => {
    authApi.register.mockResolvedValue({ user: { ...fakeUser, role: 'Tester' }, token: 'reg.jwt' });
    renderApp('/register');
    const options = Array.from(screen.getByLabelText('I am a').querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['Tester', 'Developer']);
    await userEvent.type(screen.getByLabelText('Full name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Email'), 'new@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(authApi.register).toHaveBeenCalledTimes(1));
    expect(authApi.register.mock.calls[0][0]).toEqual({
      name: 'New Person', email: 'new@test.com', password: 'Password123', accountType: 'Tester',
    });
  });
});

describe('sign out', () => {
  it('logs out via the profile menu and clears the token', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved.jwt');
    authApi.me.mockResolvedValue(fakeUser);
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /dana developer/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
