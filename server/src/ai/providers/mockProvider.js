// Deterministic stand-in for a real model. Used by the automated tests (so they never spend API quota) and
// available for demos without a key (AI_PROVIDER=mock). It applies simple keyword rules, so its output is
// plausible but obviously not intelligent; the UI labels it as a demo provider.
const state = { handler: null, failure: null, calls: [] };

export const mockControls = {
  reset() {
    state.handler = null;
    state.failure = null;
    state.calls = [];
  },
  // handler(request) may return an object, a JSON string, or throw. Overrides the built-in heuristics.
  setHandler(fn) {
    state.handler = fn;
  },
  // Make the next N calls fail with this error (e.g. new ProviderError('quota')).
  failWith(err, times = 1) {
    state.failure = { err, times };
  },
  get calls() {
    return state.calls;
  },
};

const has = (text, re) => re.test(text);

function mockTriage({ data }) {
  const text = `${data.title || ''} ${data.description || ''}`.toLowerCase();
  const category = has(text, /\b(feature request|add support|would be nice|please add|new feature)\b/) ? 'Feature'
    : has(text, /\b(improve|enhance|refactor|optimi[sz]e|slow)\b/) ? 'Improvement' : 'Bug';
  const severity = has(text, /\b(crash|data loss|security|payment|outage|cannot (log ?in|sign in))\b/) ? 'Critical'
    : has(text, /\b(error|fails?|broken|not working|exception|500)\b/) ? 'High'
      : has(text, /\b(typo|spelling|cosmetic|color|alignment)\b/) ? 'Low' : 'Medium';
  const priority = { Critical: 'Urgent', High: 'High', Medium: 'Medium', Low: 'Low' }[severity];
  const component = has(text, /\b(log ?in|sign ?in|password|auth)\b/) ? 'Authentication'
    : has(text, /\b(checkout|payment|cart)\b/) ? 'Checkout'
      : has(text, /\bsearch\b/) ? 'Search' : has(text, /\b(button|layout|page|screen|ui)\b/) ? 'UI' : '';
  const devs = [...(data.developers || [])].sort((a, b) => a.activeIssues - b.activeIssues);
  return {
    category, severity, priority, component,
    stepsToReproduce: [],
    expectedBehavior: '',
    actualBehavior: '',
    missingInformation: String(data.description || '').length < 80
      ? ['Which browser or device (and version) did this happen on?', 'What exact steps lead to the problem?', 'What did you expect to happen instead?'] : [],
    suggestedAssigneeId: devs[0]?.id ?? null,
    reasoning: { severity: 'Keyword-based demo rule.', priority: 'Derived from severity (demo).', assignee: devs[0] ? 'Lowest current workload (demo).' : '' },
  };
}

function mockImprove({ data }) {
  const description = String(data.description || '');
  const steps = description.split('\n').map((l) => l.trim()).filter((l) => /^(\d+[.)]|step\s*\d+)/i.test(l));
  return {
    summary: String(data.title || '').slice(0, 200),
    problemDescription: description,
    stepsToReproduce: steps,
    expectedBehavior: '',
    actualBehavior: '',
    environment: String(data.context || ''),
    missingDetails: ['Exact steps to reproduce', 'What you expected to happen', 'What actually happened (error text, screenshots)', 'Browser/device and version'],
  };
}

const DEFAULTS = { triage: mockTriage, improve: mockImprove };

export function createMockProvider() {
  return {
    name: 'mock',
    async generateJson(request) {
      state.calls.push({ task: request.task, model: request.model, system: request.system, user: request.user, data: request.data });
      if (state.failure && state.failure.times > 0) {
        state.failure.times -= 1;
        throw state.failure.err;
      }
      const out = state.handler ? await state.handler(request) : (DEFAULTS[request.task] ? DEFAULTS[request.task](request) : {});
      return { text: typeof out === 'string' ? out : JSON.stringify(out), model: request.model };
    },
  };
}
