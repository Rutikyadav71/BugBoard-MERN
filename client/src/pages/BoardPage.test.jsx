import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import BoardPage from './BoardPage.jsx';
import { ToastProvider } from '../components/Toast.jsx';
import { issuesApi } from '../api/issues.js';
import { projectsApi } from '../api/projects.js';

// Capture the handlers the board hands to the drag-and-drop library so tests can "drop" a card.
let handlers;
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ onDragStart, onDragEnd, children }) => { handlers = { onDragStart, onDragEnd }; return <div>{children}</div>; },
  Droppable: ({ children, droppableId }) => children({ innerRef: () => {}, droppableProps: { 'data-col': droppableId }, placeholder: null }, { isDraggingOver: false }),
  Draggable: ({ children }) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));
vi.mock('../api/issues.js', () => ({ issuesApi: { list: vi.fn(), setStatus: vi.fn() } }));
vi.mock('../api/projects.js', () => ({ projectsApi: { list: vi.fn() } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { _id: 'u1', name: 'Dana Dev', role: 'Developer' } }) }));

const issue = (over = {}) => ({
  _id: 'i1', key: 'WEB-1', title: 'Checkout crashes', status: 'Open', priority: 'High', severity: 'High',
  reporter: { name: 'Tia Tester' }, assignee: { _id: 'u1', name: 'Dana Dev' },
  capabilities: { allowedTransitions: ['In Progress'] }, ...over,
});

const renderBoard = () => render(<MemoryRouter><ToastProvider><BoardPage /></ToastProvider></MemoryRouter>);
const columnText = (name) => screen.getByRole('region', { name: `${name} column` }).textContent;

async function drop(issueId, from, to) {
  await act(async () => { handlers.onDragStart({ draggableId: issueId }); });
  await act(async () => { await handlers.onDragEnd({ draggableId: issueId, source: { droppableId: from, index: 0 }, destination: { droppableId: to, index: 0 } }); });
}

beforeEach(() => {
  vi.clearAllMocks();
  projectsApi.list.mockResolvedValue({ items: [] });
  issuesApi.list.mockResolvedValue({ items: [issue(), issue({ _id: 'i2', key: 'WEB-2', title: 'Typo', capabilities: { allowedTransitions: [] } })], meta: {} });
});

describe('Kanban board', () => {
  it('places issues in the column matching their status', async () => {
    renderBoard();
    await screen.findByText('Checkout crashes');
    expect(columnText('Open')).toContain('WEB-1');
    expect(columnText('In Progress')).not.toContain('WEB-1');
  });

  it('shows all five workflow columns', async () => {
    renderBoard();
    await screen.findByText('Checkout crashes');
    for (const s of ['Open', 'In Progress', 'Testing', 'Resolved', 'Closed']) expect(screen.getByRole('region', { name: `${s} column` })).toBeInTheDocument();
  });

  it('a successful drop persists via the API and shows the server version', async () => {
    issuesApi.setStatus.mockResolvedValue(issue({ status: 'In Progress', capabilities: { allowedTransitions: ['Testing'] } }));
    renderBoard();
    await screen.findByText('Checkout crashes');
    await drop('i1', 'Open', 'In Progress');
    expect(issuesApi.setStatus).toHaveBeenCalledWith('i1', 'In Progress');
    await waitFor(() => expect(columnText('In Progress')).toContain('WEB-1'));
    expect(columnText('Open')).not.toContain('WEB-1');
    expect(await screen.findByText(/WEB-1 moved to In Progress/)).toBeInTheDocument();
  });

  it('a rejected drop REVERTS the card and shows the server error', async () => {
    issuesApi.setStatus.mockRejectedValue({ response: { status: 403, data: { message: "Role 'Developer' cannot move an issue from 'Open' to 'Testing'" } } });
    renderBoard();
    await screen.findByText('Checkout crashes');
    await drop('i1', 'Open', 'Testing');
    expect(await screen.findByText(/cannot move an issue from 'Open' to 'Testing'/)).toBeInTheDocument();
    expect(columnText('Open')).toContain('WEB-1');
    expect(columnText('Testing')).not.toContain('WEB-1');
  });

  it('dropping in the same column does nothing', async () => {
    renderBoard();
    await screen.findByText('Checkout crashes');
    await drop('i1', 'Open', 'Open');
    expect(issuesApi.setStatus).not.toHaveBeenCalled();
  });

  it('dropping outside any column does nothing', async () => {
    renderBoard();
    await screen.findByText('Checkout crashes');
    await act(async () => { handlers.onDragStart({ draggableId: 'i1' }); });
    await act(async () => { await handlers.onDragEnd({ draggableId: 'i1', source: { droppableId: 'Open', index: 0 }, destination: null }); });
    expect(issuesApi.setStatus).not.toHaveBeenCalled();
    expect(columnText('Open')).toContain('WEB-1');
  });

  it('shows an empty state when there are no issues', async () => {
    issuesApi.list.mockResolvedValue({ items: [], meta: {} });
    renderBoard();
    expect(await screen.findByText('The board is empty')).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    issuesApi.list.mockRejectedValueOnce({ response: { data: { message: 'Database unavailable' } } });
    renderBoard();
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    issuesApi.list.mockResolvedValueOnce({ items: [issue()], meta: {} });
    await act(async () => { screen.getByRole('button', { name: /try again/i }).click(); });
    expect(await screen.findByText('Checkout crashes')).toBeInTheDocument();
  });
});
