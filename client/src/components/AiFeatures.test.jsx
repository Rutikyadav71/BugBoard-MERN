import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi } from 'vitest';
import SimilarIssues from './SimilarIssues.jsx';
import AiAssistPanel from './AiAssistPanel.jsx';
import IssueForm from './IssueForm.jsx';
import { aiApi } from '../api/ai.js';
import { formatDueDate, isOverdue } from '../utils/constants.js';

vi.mock('../api/ai.js', () => ({ aiApi: { status: vi.fn(), triage: vi.fn(), improve: vi.fn(), similar: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

// ------------------------------------------------------------------ similar issues
describe('SimilarIssues', () => {
  const match = (over = {}) => ({
    issueId: 'a'.repeat(24), key: 'WEB-1', title: 'Login fails on Safari', status: 'Open', severity: 'High', priority: 'High',
    snippet: 'Users on Safari cannot sign in.', score: 0.72, label: 'Very similar', matchedTerms: ['safari', 'login'], ...over,
  });

  it('shows a hint and makes no request while the title is too short', () => {
    render(<SimilarIssues projectId="p1" title="Log" delay={1} />);
    expect(screen.getByText(/Enter a title \(5\+ characters\)/)).toBeInTheDocument();
    expect(aiApi.similar).not.toHaveBeenCalled();
  });

  it('searches the chosen project with the trimmed draft and lists matches with an explanation', async () => {
    aiApi.similar.mockResolvedValue({ items: [match()], meta: {} });
    render(<SimilarIssues projectId="p1" title="  Cannot login on Safari " description=" sign in button does nothing " delay={1} />);
    expect(await screen.findByText('Login fails on Safari')).toBeInTheDocument();
    expect(aiApi.similar).toHaveBeenCalledWith({ project: 'p1', title: 'Cannot login on Safari', description: 'sign in button does nothing' });
    expect(screen.getByText('WEB-1')).toBeInTheDocument();
    expect(screen.getByText('Very similar · 72%')).toBeInTheDocument();
    expect(screen.getByText(/Shared words: safari, login/)).toBeInTheDocument();
    expect(screen.getByText(/wording only/i)).toBeInTheDocument(); // framed as a text match, not a verdict
  });

  it('opens matches in a new tab so the draft is not lost', async () => {
    aiApi.similar.mockResolvedValue({ items: [match()], meta: {} });
    render(<SimilarIssues projectId="p1" title="Cannot login on Safari" delay={1} />);
    const link = await screen.findByRole('link', { name: /Open/ });
    expect(link).toHaveAttribute('href', `/issues/${'a'.repeat(24)}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
  });

  it('says so when nothing similar exists', async () => {
    aiApi.similar.mockResolvedValue({ items: [], meta: {} });
    render(<SimilarIssues projectId="p1" title="Totally new problem" delay={1} />);
    expect(await screen.findByText('No similar issues found in this project.')).toBeInTheDocument();
  });

  it('shows a non-blocking error and reassures the user they can still submit', async () => {
    aiApi.similar.mockRejectedValue({ response: { data: { message: 'Server unavailable' } } });
    render(<SimilarIssues projectId="p1" title="Cannot login on Safari" delay={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable. You can still submit the issue.');
  });

  it('debounces: rapid edits trigger a single request for the latest text', async () => {
    aiApi.similar.mockResolvedValue({ items: [], meta: {} });
    const { rerender } = render(<SimilarIssues projectId="p1" title="Login fails" delay={40} />);
    rerender(<SimilarIssues projectId="p1" title="Login fails on Safari" delay={40} />);
    await waitFor(() => expect(aiApi.similar).toHaveBeenCalledTimes(1));
    expect(aiApi.similar.mock.calls[0][0].title).toBe('Login fails on Safari');
  });
});

// ------------------------------------------------------------------ AI assist panel
function Host({ isAdmin = false, assignable = [], title = 'Login fails on Safari', description = 'cannot sign in' }) {
  const { register, getValues, setValue } = useForm({
    defaultValues: { project: 'p1', title, description, severity: 'Medium', priority: 'Medium', category: 'Bug', component: '', assignee: '' },
  });
  return (
    <form>
      {['title', 'severity', 'priority', 'category', 'component', 'assignee'].map((f) => <input key={f} aria-label={`field-${f}`} {...register(f)} />)}
      <textarea aria-label="field-description" {...register('description')} />
      <AiAssistPanel projectId="p1" getValues={getValues} setValue={setValue} isAdmin={isAdmin} assignable={assignable} />
    </form>
  );
}
const field = (name) => screen.getByLabelText(`field-${name}`);

const triageResult = (over = {}) => ({
  suggestions: {
    category: 'Bug', severity: 'High', priority: 'Urgent', component: 'Authentication',
    stepsToReproduce: [], expectedBehavior: '', actualBehavior: '', missingInformation: ['Which Safari version?'],
    reasoning: { severity: 'Blocks sign in.', priority: 'Many users affected.', assignee: 'Lowest workload.' }, suggestedAssignee: null, ...(over.suggestions || {}),
  },
  warnings: over.warnings || [],
  meta: { advisory: true, demo: false, model: 'gemini-test', notice: 'AI suggestions are a starting point, not a verdict. Review and edit them before saving.', ...(over.meta || {}) },
});
const improveResult = (over = {}) => ({
  original: { title: 'Login fails on Safari', description: 'cannot sign in', context: '' },
  improved: { title: 'Safari login fails', description: 'Problem:\nUsers cannot sign in on Safari.', missingDetails: ['Safari version'], ...(over.improved || {}) },
  warnings: over.warnings || [],
  meta: { advisory: true, demo: false, model: 'gemini-test', notice: 'The improved text is a suggestion. Nothing is saved until you approve it.' },
});
const available = () => aiApi.status.mockResolvedValue({ available: true, reason: null, provider: 'gemini', model: 'gemini-test', dataNotice: 'Text you send to AI features is processed by Google Gemini.' });

describe('AiAssistPanel availability', () => {
  it('explains why AI is unavailable, disables the buttons, and leaves the form usable', async () => {
    aiApi.status.mockResolvedValue({ available: false, reason: 'AI is not configured: set GEMINI_API_KEY in server/.env.' });
    render(<Host />);
    expect(await screen.findByText(/AI suggestions are unavailable: AI is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggest triage/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /improve description/i })).toBeDisabled();
    await userEvent.type(field('title'), ' more');
    expect(field('title')).toHaveValue('Login fails on Safari more');
  });

  it('copes with the status request failing', async () => {
    aiApi.status.mockRejectedValue({ response: { data: { message: 'x' } } });
    render(<Host />);
    expect(await screen.findByText(/Could not check whether AI is available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggest triage/i })).toBeDisabled();
  });

  it('shows the data-handling notice when AI is available', async () => {
    available();
    render(<Host />);
    expect(await screen.findByText(/processed by Google Gemini/)).toBeInTheDocument();
  });
});

describe('AiAssistPanel triage review', () => {
  it('sends the draft plus optional context, and applies NOTHING until the user accepts', async () => {
    available();
    aiApi.triage.mockResolvedValue(triageResult());
    render(<Host />);
    await userEvent.type(await screen.findByLabelText(/Extra context/), 'Safari on iPad');
    await userEvent.click(screen.getByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByLabelText('Triage suggestions')).toBeInTheDocument();
    expect(aiApi.triage).toHaveBeenCalledWith({ project: 'p1', title: 'Login fails on Safari', description: 'cannot sign in', context: 'Safari on iPad' });
    expect(field('severity')).toHaveValue('Medium'); // untouched
    expect(field('priority')).toHaveValue('Medium');
    expect(screen.getByText(/Nothing is applied until you accept it/)).toBeInTheDocument();
    expect(screen.getByText(/not a verdict/)).toBeInTheDocument();
  });

  it('accepting applies exactly that suggestion; dismissing leaves the form alone', async () => {
    available();
    aiApi.triage.mockResolvedValue(triageResult());
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Accept severity suggestion' }));
    expect(field('severity')).toHaveValue('High');
    expect(screen.getAllByText('Applied to the form')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss priority suggestion' }));
    expect(field('priority')).toHaveValue('Medium');
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(field('component')).toHaveValue(''); // never touched
  });

  it('lets the user edit a suggestion before accepting it', async () => {
    available();
    aiApi.triage.mockResolvedValue(triageResult());
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    await userEvent.selectOptions(await screen.findByLabelText('Severity'), 'Critical');
    await userEvent.clear(screen.getByLabelText('Component'));
    await userEvent.type(screen.getByLabelText('Component'), 'Auth service');
    await userEvent.click(screen.getByRole('button', { name: 'Accept severity suggestion' }));
    await userEvent.click(screen.getByRole('button', { name: 'Accept component suggestion' }));
    expect(field('severity')).toHaveValue('Critical');
    expect(field('component')).toHaveValue('Auth service');
  });

  it('shows the assignee suggestion (with workload) to Admins only, and applies it on accept', async () => {
    available();
    const result = triageResult({ suggestions: { suggestedAssignee: { id: 'u2', name: 'Dee Dev', activeIssues: 1 } } });
    aiApi.triage.mockResolvedValue(result);
    const devs = [{ _id: 'u1', name: 'Dan Dev' }, { _id: 'u2', name: 'Dee Dev' }];
    const { unmount } = render(<Host isAdmin assignable={devs} />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByLabelText('Assignee')).toHaveValue('u2');
    expect(screen.getByText(/1 active issue right now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept assignee suggestion' }));
    expect(field('assignee')).toHaveValue('u2');
    unmount();

    render(<Host isAdmin={false} assignable={devs} />); // even if a response carried one, non-admins never see it
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    await screen.findByLabelText('Triage suggestions');
    expect(screen.queryByLabelText('Assignee')).not.toBeInTheDocument();
  });

  it('adds details the AI found in the text to the description only on request', async () => {
    available();
    aiApi.triage.mockResolvedValue(triageResult({ suggestions: { stepsToReproduce: ['Open login', 'Press Sign in'], expectedBehavior: 'User is signed in', actualBehavior: 'Error page' } }));
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    await screen.findByText('Details found in your text');
    expect(field('description')).toHaveValue('cannot sign in');
    await userEvent.click(screen.getByRole('button', { name: 'Add to description' }));
    expect(field('description').value).toBe('cannot sign in\n\nSteps to reproduce:\n1. Open login\n2. Press Sign in\n\nExpected behavior:\nUser is signed in\n\nActual behavior:\nError page');
    expect(screen.getByRole('button', { name: 'Added to description' })).toBeDisabled();
  });

  it('lists clarifying questions, warnings, and labels the demo provider', async () => {
    available();
    aiApi.triage.mockResolvedValue(triageResult({ warnings: ['Ignored an invalid severity suggestion from the AI.'], meta: { demo: true } }));
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByText('Which Safari version?')).toBeInTheDocument();
    expect(screen.getByText('Ignored an invalid severity suggestion from the AI.')).toBeInTheDocument();
    expect(screen.getByText('Demo provider: not a real model')).toBeInTheDocument();
  });

  it('shows the server error and leaves the form fully usable when AI fails', async () => {
    available();
    aiApi.triage.mockRejectedValue({ response: { status: 503, data: { code: 'AI_QUOTA_EXHAUSTED', message: "The AI provider's free-tier quota is used up for now. Try again later; everything else in BugBoard still works." } } });
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/free-tier quota is used up/);
    expect(screen.queryByLabelText('Triage suggestions')).not.toBeInTheDocument();
    await userEvent.type(field('title'), '!');
    expect(field('title')).toHaveValue('Login fails on Safari!');
    expect(screen.getByRole('button', { name: /suggest triage/i })).toBeEnabled(); // can retry later
  });

  it('asks for a title first instead of calling the API', async () => {
    available();
    render(<Host title="" />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a title (at least 3 characters) first.');
    expect(aiApi.triage).not.toHaveBeenCalled();
  });

  it('shows progress and blocks double submission while a request is running', async () => {
    available();
    let finish;
    aiApi.triage.mockReturnValue(new Promise((res) => { finish = res; }));
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /suggest triage/i }));
    expect(await screen.findByRole('button', { name: /analysing/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /improve description/i })).toBeDisabled();
    finish(triageResult());
    expect(await screen.findByLabelText('Triage suggestions')).toBeInTheDocument();
    expect(aiApi.triage).toHaveBeenCalledTimes(1);
  });
});

describe('AiAssistPanel description improver', () => {
  async function openImprover(result = improveResult()) {
    available();
    aiApi.improve.mockResolvedValue(result);
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /improve description/i }));
    return screen.findByLabelText('Improved description');
  }

  it('shows original and improved side by side and changes nothing until approved', async () => {
    await openImprover();
    expect(screen.getByLabelText('Your original')).toHaveValue('cannot sign in');
    expect(screen.getByLabelText('Your original')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Improved (editable)')).toHaveValue('Problem:\nUsers cannot sign in on Safari.');
    expect(field('description')).toHaveValue('cannot sign in'); // not replaced yet
    expect(screen.getByText('Safari version')).toBeInTheDocument(); // what is still missing
    expect(screen.getByText(/Nothing is saved until you approve it/)).toBeInTheDocument();
  });

  it('applies the EDITED text on explicit approval, and the title only if chosen', async () => {
    await openImprover();
    const improved = screen.getByLabelText('Improved (editable)');
    await userEvent.clear(improved);
    await userEvent.type(improved, 'My own wording');
    await userEvent.click(screen.getByRole('button', { name: /use improved description/i }));
    expect(field('description')).toHaveValue('My own wording');
    expect(field('title')).toHaveValue('Login fails on Safari'); // title untouched
    expect(screen.getByRole('status')).toHaveTextContent('Description replaced');

    await userEvent.click(screen.getByLabelText(/also replace the title/i));
    await userEvent.click(screen.getByRole('button', { name: /use improved description/i }));
    expect(field('title')).toHaveValue('Safari login fails');
  });

  it('shows warnings about details that were not in the original text', async () => {
    await openImprover(improveResult({ warnings: ['The improved report mentions "Chrome 120", which is not in your original text. Check it or delete it.'] }));
    expect(screen.getByText(/mentions "Chrome 120"/)).toBeInTheDocument();
  });

  it('can regenerate and discard', async () => {
    await openImprover();
    aiApi.improve.mockResolvedValue(improveResult({ improved: { description: 'Second attempt' } }));
    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    await waitFor(() => expect(screen.getByLabelText('Improved (editable)')).toHaveValue('Second attempt'));
    expect(aiApi.improve).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByLabelText('Improved description')).not.toBeInTheDocument();
    expect(field('description')).toHaveValue('cannot sign in');
  });

  it('shows an error when improvement fails', async () => {
    available();
    aiApi.improve.mockRejectedValue({ response: { data: { message: 'The AI request timed out. Please try again.' } } });
    render(<Host />);
    await userEvent.click(await screen.findByRole('button', { name: /improve description/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The AI request timed out');
  });
});

// ------------------------------------------------------------------ form fields + helpers
describe('IssueForm optional fields', () => {
  const projects = [{ _id: 'p1', key: 'ALP', name: 'Alpha' }];

  it('submits category, component and due date', async () => {
    const onSubmit = vi.fn();
    render(<IssueForm projects={projects} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('Title'), 'Checkout crashes');
    await userEvent.type(screen.getByLabelText('Description'), 'It crashes on submit');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Improvement');
    await userEvent.type(screen.getByLabelText(/Component/), 'Checkout');
    await userEvent.type(screen.getByLabelText(/Due date/), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: /create issue/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Checkout crashes', category: 'Improvement', component: 'Checkout', dueDate: '2026-12-31' });
  });

  it('pre-fills the fields when editing', () => {
    const initial = { title: 'T title', description: 'Some description', project: { _id: 'p1' }, severity: 'High', priority: 'Low', category: 'Feature', component: 'API', dueDate: '2026-12-31T00:00:00.000Z' };
    render(<IssueForm isEdit initial={initial} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText('Category')).toHaveValue('Feature');
    expect(screen.getByLabelText(/Component/)).toHaveValue('API');
    expect(screen.getByLabelText(/Due date/)).toHaveValue('2026-12-31');
  });

  it('renders helpers supplied through renderAssist with access to the form', async () => {
    render(<IssueForm projects={projects} onSubmit={() => {}} onCancel={() => {}}
      renderAssist={({ getValues, setValue }) => <button type="button" onClick={() => setValue('title', `${getValues('title')}!`)}>bang</button>} />);
    await userEvent.type(screen.getByLabelText('Title'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'bang' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Hello!');
  });
});

describe('due date helpers', () => {
  it('isOverdue: only past dates on unfinished issues', () => {
    const now = new Date(2026, 5, 15, 10, 0, 0); // 15 June 2026, local time
    expect(isOverdue('2026-06-14T00:00:00.000Z', 'Open', now)).toBe(true);
    expect(isOverdue('2026-06-14T00:00:00.000Z', 'In Progress', now)).toBe(true);
    expect(isOverdue('2026-06-14T00:00:00.000Z', 'Resolved', now)).toBe(false);
    expect(isOverdue('2026-06-14T00:00:00.000Z', 'Closed', now)).toBe(false);
    expect(isOverdue('2026-06-15T00:00:00.000Z', 'Open', now)).toBe(false); // due today is not overdue
    expect(isOverdue('2026-06-16T00:00:00.000Z', 'Open', now)).toBe(false);
    expect(isOverdue(null, 'Open', now)).toBe(false);
  });

  it('formatDueDate shows the stored calendar day regardless of time zone', () => {
    expect(formatDueDate('2026-12-31T00:00:00.000Z')).toMatch(/31/);
    expect(formatDueDate(null)).toBe('-');
  });
});
