import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { ToastProvider } from '../components/Toast.jsx';
import DashboardPage from './DashboardPage.jsx';
import IssueDetailPage from './IssueDetailPage.jsx';
import IssuesPage from './IssuesPage.jsx';
import { dashboardApi, issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';

let currentUser;
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('../api/issues.js', () => ({
  issuesApi: { list: vi.fn(), get: vi.fn(), comments: vi.fn(), activity: vi.fn(), setStatus: vi.fn(), assign: vi.fn(), addComment: vi.fn(), remove: vi.fn() },
  dashboardApi: { stats: vi.fn(), assigned: vi.fn() },
}));
vi.mock('../api/projects.js', () => ({ projectsApi: { list: vi.fn(), assignable: vi.fn() } }));
// Recharts needs real layout sizes that jsdom lacks; charts are covered by their own data-driven aria labels.
vi.mock('../components/DashboardCharts.jsx', () => ({
  StatusChart: ({ data }) => <div data-testid="status-chart">{data.map((d) => `${d.name}:${d.value}`).join(',')}</div>,
  PriorityChart: ({ data }) => <div data-testid="priority-chart">{data.map((d) => `${d.name}:${d.value}`).join(',')}</div>,
}));

const stats = (over = {}) => ({
  role: 'Admin', projects: [{ _id: 'p1', key: 'WEB', name: 'Website' }], selectedProject: null,
  summary: { total: 8, open: 3, inProgress: 2, testing: 1, resolved: 1, closed: 1, critical: 2, assignedToMe: 3, reportedByMe: 6 },
  byStatus: [{ name: 'Open', value: 3 }], byPriority: [{ name: 'Low', value: 1 }], bySeverity: [],
  recentIssues: [{ _id: 'i1', key: 'WEB-1', title: 'Checkout crashes', status: 'Open', priority: 'High', project: { name: 'Website' }, updatedAt: new Date().toISOString() }],
  recentlyUpdated: [], ...over,
});
const wrap = (ui, route = '/') => render(<MemoryRouter initialEntries={[route]}><ToastProvider>{ui}</ToastProvider></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); dashboardApi.assigned.mockResolvedValue([]); });

describe('Dashboard', () => {
  it('shows API numbers and links cards to filtered issue lists', async () => {
    currentUser = { _id: 'u1', name: 'Ada Admin', role: 'Admin' };
    dashboardApi.stats.mockResolvedValue(stats());
    wrap(<DashboardPage />);
    const open = await screen.findByRole('link', { name: 'Open issues: 3' });
    expect(open).toHaveAttribute('href', '/issues?status=Open');
    expect(screen.getByRole('link', { name: 'Total issues: 8' })).toHaveAttribute('href', '/issues');
    expect(screen.getByRole('link', { name: 'Resolved issues: 1' })).toHaveAttribute('href', '/issues?status=Resolved');
    expect(screen.getByTestId('status-chart')).toHaveTextContent('Open:3');
  });

  it('Developer sees "Assigned to me" and a work queue; Tester sees "Reported by me"', async () => {
    currentUser = { _id: 'u2', name: 'Dan Dev', role: 'Developer' };
    dashboardApi.stats.mockResolvedValue(stats({ role: 'Developer' }));
    dashboardApi.assigned.mockResolvedValue([{ _id: 'i9', key: 'MOB-1', title: 'Rotation crash', status: 'Open', priority: 'Urgent', project: { name: 'Mobile' }, updatedAt: new Date().toISOString() }]);
    const { unmount } = wrap(<DashboardPage />);
    expect(await screen.findByRole('link', { name: 'Assigned to me: 3' })).toHaveAttribute('href', '/issues?assignee=me');
    expect(await screen.findByText('My assigned issues')).toBeInTheDocument();
    expect(await screen.findByText('Rotation crash')).toBeInTheDocument();
    unmount();

    currentUser = { _id: 'u3', name: 'Tia Tester', role: 'Tester' };
    dashboardApi.stats.mockResolvedValue(stats({ role: 'Tester' }));
    wrap(<DashboardPage />);
    expect(await screen.findByRole('link', { name: 'Reported by me: 6' })).toHaveAttribute('href', '/issues?reporter=u3');
    expect(screen.queryByText('My assigned issues')).not.toBeInTheDocument();
  });

  it('carries the selected project into card links', async () => {
    currentUser = { _id: 'u1', name: 'Ada Admin', role: 'Admin' };
    dashboardApi.stats.mockResolvedValue(stats());
    wrap(<DashboardPage />, '/?project=p1');
    expect(await screen.findByRole('link', { name: 'Open issues: 3' })).toHaveAttribute('href', '/issues?status=Open&project=p1');
  });

  it('shows an empty state for users with no projects', async () => {
    currentUser = { _id: 'u2', name: 'Dan Dev', role: 'Developer' };
    dashboardApi.stats.mockResolvedValue(stats({ projects: [] }));
    wrap(<DashboardPage />);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('shows an error with retry when the API fails', async () => {
    currentUser = { _id: 'u1', name: 'Ada Admin', role: 'Admin' };
    dashboardApi.stats.mockRejectedValueOnce({ response: { data: { message: 'Boom' } } });
    wrap(<DashboardPage />);
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

const detail = (caps, over = {}) => ({
  _id: 'i1', key: 'WEB-1', title: 'Checkout crashes', description: 'Pay button fails', status: 'Open', priority: 'High', severity: 'High',
  project: { _id: 'p1', name: 'Website', key: 'WEB' }, reporter: { _id: 'r', name: 'Tia Tester' }, assignee: { _id: 'd', name: 'Dan Dev' },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
  capabilities: { canEdit: false, canAssign: false, canDelete: false, allowedTransitions: [], ...caps }, ...over,
});
const renderDetail = () => wrap(<Routes><Route path="/issues/:id" element={<IssueDetailPage />} /></Routes>, '/issues/i1');

describe('Issue details page respects capabilities', () => {
  beforeEach(() => {
    issuesApi.comments.mockResolvedValue([]);
    issuesApi.activity.mockResolvedValue([{ _id: 'a1', action: 'issue_created', from: null, to: 'Open', user: { name: 'Tia Tester' }, createdAt: new Date().toISOString() }]);
    projectsApi.assignable.mockResolvedValue([{ _id: 'd', name: 'Dan Dev' }]);
  });

  it('read-only viewer sees no edit, delete, assign or status controls', async () => {
    currentUser = { _id: 'x', name: 'Viewer', role: 'Developer' };
    issuesApi.get.mockResolvedValue(detail({}));
    renderDetail();
    await screen.findByText('Checkout crashes');
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Move to:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assignee')).not.toBeInTheDocument();
  });

  it('shows ONLY the transitions the server allows, and calls the API when clicked', async () => {
    currentUser = { _id: 'd', name: 'Dan Dev', role: 'Developer' };
    issuesApi.get.mockResolvedValue(detail({ canEdit: true, allowedTransitions: ['In Progress'] }));
    issuesApi.setStatus.mockResolvedValue(detail({ allowedTransitions: ['Testing'] }, { status: 'In Progress' }));
    renderDetail();
    const btn = await screen.findByRole('button', { name: /in progress/i });
    expect(screen.queryByRole('button', { name: /^testing$/i })).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(issuesApi.setStatus).toHaveBeenCalledWith('i1', 'In Progress');
    expect(await screen.findByRole('button', { name: /testing/i })).toBeInTheDocument();
  });

  it('Admin gets an assignee dropdown and delete needs confirmation', async () => {
    currentUser = { _id: 'a', name: 'Ada Admin', role: 'Admin' };
    issuesApi.get.mockResolvedValue(detail({ canEdit: true, canAssign: true, canDelete: true }));
    renderDetail();
    expect(await screen.findByLabelText('Assignee')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/cannot be undone/i);
    expect(issuesApi.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the activity timeline and blocks empty comments client-side', async () => {
    currentUser = { _id: 'a', name: 'Ada Admin', role: 'Admin' };
    issuesApi.get.mockResolvedValue(detail({}));
    renderDetail();
    expect(await screen.findByText(/created this issue/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /comment/i }));
    expect(await screen.findByText('Comment cannot be empty')).toBeInTheDocument();
    expect(issuesApi.addComment).not.toHaveBeenCalled();
  });

  it('posting a comment appends it', async () => {
    currentUser = { _id: 'a', name: 'Ada Admin', role: 'Admin' };
    issuesApi.get.mockResolvedValue(detail({}));
    issuesApi.addComment.mockResolvedValue({ _id: 'c1', text: 'Looking into it', author: { name: 'Ada Admin', role: 'Admin' }, createdAt: new Date().toISOString() });
    renderDetail();
    await userEvent.type(await screen.findByLabelText('Add a comment'), 'Looking into it');
    await userEvent.click(screen.getByRole('button', { name: /^comment$/i }));
    expect(await screen.findByText('Looking into it')).toBeInTheDocument();
    expect(issuesApi.addComment).toHaveBeenCalledWith('i1', 'Looking into it');
  });

  it('shows an error state when the issue cannot be loaded (e.g. 404)', async () => {
    currentUser = { _id: 'a', name: 'Ada Admin', role: 'Admin' };
    issuesApi.get.mockRejectedValue({ response: { status: 404, data: { message: 'Issue not found' } } });
    renderDetail();
    expect(await screen.findByText('Issue not found')).toBeInTheDocument();
  });
});

describe('Issues list', () => {
  beforeEach(() => {
    projectsApi.list.mockResolvedValue({ items: [{ _id: 'p1', key: 'WEB', name: 'Website', members: [{ _id: 'd', name: 'Dan Dev' }] }] });
    issuesApi.list.mockResolvedValue({ items: [{ _id: 'i1', key: 'WEB-1', title: 'Checkout crashes', status: 'Open', priority: 'High', severity: 'High', reporter: { name: 'Tia' }, assignee: null, updatedAt: '2026-01-01T00:00:00Z' }], meta: { total: 1, pages: 1, page: 1, limit: 10 } });
  });

  it('reads filters from the URL (dashboard deep links) and sends them to the API', async () => {
    currentUser = { _id: 'a', name: 'Ada', role: 'Admin' };
    wrap(<IssuesPage />, '/?status=Open&priority=High');
    await screen.findByText('Checkout crashes');
    expect(issuesApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'Open', priority: 'High', page: 1 }));
    expect(screen.getByLabelText('Status')).toHaveValue('Open');
  });

  it('changing a filter re-queries the API', async () => {
    currentUser = { _id: 'a', name: 'Ada', role: 'Admin' };
    wrap(<IssuesPage />);
    await screen.findByText('Checkout crashes');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'Critical');
    await waitFor(() => expect(issuesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'Critical' })));
  });

  it('every role sees the "New issue" button', async () => {
    for (const role of ['Developer', 'Tester', 'Admin']) {
      currentUser = { _id: 'u', name: 'Sam', role };
      const { unmount } = wrap(<IssuesPage />);
      expect(await screen.findByRole('link', { name: /new issue/i })).toBeInTheDocument();
      unmount();
    }
  });

  it('empty results with filters offer to clear them', async () => {
    currentUser = { _id: 'a', name: 'Ada', role: 'Admin' };
    issuesApi.list.mockResolvedValue({ items: [], meta: { total: 0, pages: 0, page: 1, limit: 10 } });
    wrap(<IssuesPage />, '/?status=Closed');
    expect(await screen.findByText('No issues match your filters')).toBeInTheDocument();
  });
});

describe('Issues list multi-value filters', () => {
  it('shows a multi-status dashboard link (e.g. active critical) as selected instead of "Any status"', async () => {
    currentUser = { _id: 'a', name: 'Ada', role: 'Admin' };
    projectsApi.list.mockResolvedValue({ items: [] });
    issuesApi.list.mockResolvedValue({ items: [], meta: { total: 0, pages: 0, page: 1, limit: 10 } });
    wrap(<IssuesPage />, '/?severity=Critical&status=Open,In%20Progress,Testing');
    await screen.findByText('No issues match your filters');
    expect(issuesApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'Open,In Progress,Testing', severity: 'Critical' }));
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Open / In Progress / Testing');
  });
});
