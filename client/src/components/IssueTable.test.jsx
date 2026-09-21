import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, afterEach } from 'vitest';
import IssueTable from './IssueTable.jsx';

const issues = [{
  _id: 'i1', key: 'WEB-1', title: 'Checkout crashes', status: 'Open', priority: 'High', severity: 'Critical',
  reporter: { name: 'Tia Tester' }, assignee: { name: 'Dan Developer' }, updatedAt: '2026-01-02T00:00:00.000Z',
}];

// jsdom has no matchMedia; this stub lets a test choose the viewport class.
function stubViewport(isDesktop) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: isDesktop, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}
const renderTable = () => render(<MemoryRouter><IssueTable issues={issues} /></MemoryRouter>);

afterEach(() => { delete window.matchMedia; });

describe('IssueTable responsive layout', () => {
  it('renders the table on desktop widths', () => {
    stubViewport(true);
    renderTable();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Checkout crashes/ })).toHaveAttribute('href', '/issues/i1');
  });

  it('renders cards (no table) on phone widths and keeps every field visible', () => {
    stubViewport(false);
    renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Issues' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Checkout crashes/ })).toHaveAttribute('href', '/issues/i1');
    for (const text of ['Open', 'High', 'Critical', 'Dan Developer', 'Tia Tester']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('falls back to the table when matchMedia is unavailable', () => {
    renderTable();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
