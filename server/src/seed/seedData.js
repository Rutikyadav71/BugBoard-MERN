// Demo data. LOCAL DEMO CREDENTIALS ONLY - never use these passwords anywhere real.
export const DEMO_PASSWORD = 'Password123';

export const users = [
  { name: 'Ada Admin', email: 'admin@bugboard.local', role: 'Admin' },
  { name: 'Dan Developer', email: 'dev1@bugboard.local', role: 'Developer' },
  { name: 'Dee Developer', email: 'dev2@bugboard.local', role: 'Developer' },
  { name: 'Tia Tester', email: 'tester1@bugboard.local', role: 'Tester' },
  { name: 'Tom Tester', email: 'tester2@bugboard.local', role: 'Tester' },
];

export const projects = [
  {
    key: 'WEB', name: 'Company Website', description: 'Public marketing website and customer portal.',
    members: ['admin', 'dev1', 'dev2', 'tester1', 'tester2'],
  },
  {
    key: 'MOB', name: 'Mobile App', description: 'Cross-platform mobile application.',
    members: ['admin', 'dev1', 'tester1'],
  },
];

// reporter/assignee use the short aliases below. `history` is the ordered list of status steps already taken.
export const issues = [
  { project: 'WEB', title: 'Checkout page crashes on submit', description: 'Clicking "Pay now" throws a 500 error for saved cards.', severity: 'Critical', priority: 'Urgent', reporter: 'tester1', assignee: 'dev1', history: ['In Progress'], comments: [['dev1', 'Reproduced locally. Looks like a null card token.'], ['tester1', 'Happens on both Chrome and Firefox.']] },
  { project: 'WEB', title: 'Typo in footer copyright text', description: 'Footer says "Copywrite" instead of "Copyright".', severity: 'Low', priority: 'Low', reporter: 'tester2', assignee: null, history: [], comments: [] },
  { project: 'WEB', title: 'Login fails on Safari 17', description: 'Users on Safari cannot sign in; the button does nothing.', severity: 'High', priority: 'High', reporter: 'tester1', assignee: 'dev2', history: ['In Progress', 'Testing'], comments: [['dev2', 'Fixed cookie SameSite handling. Ready for verification.']] },
  { project: 'WEB', title: 'Search results are slow', description: 'Search takes over 5 seconds for common queries.', severity: 'Medium', priority: 'High', reporter: 'tester2', assignee: 'dev1', history: ['In Progress', 'Testing', 'Resolved'], comments: [['tester2', 'Verified: results now return in under 1 second.']] },
  { project: 'WEB', title: 'Broken link on pricing page', description: 'The "Contact sales" link returns 404.', severity: 'Medium', priority: 'Medium', reporter: 'tester1', assignee: 'dev2', history: ['In Progress', 'Testing', 'Resolved', 'Closed'], comments: [] },
  { project: 'MOB', title: 'App crashes when rotating screen', description: 'Rotating the phone on the profile screen closes the app.', severity: 'Critical', priority: 'Urgent', reporter: 'tester1', assignee: 'dev1', history: [], comments: [['admin', 'Top priority for the next release.']] },
  { project: 'MOB', title: 'Push notification icon is blurry', description: 'The notification icon looks pixelated on high-density screens.', severity: 'Low', priority: 'Medium', reporter: 'tester1', assignee: null, history: [], comments: [] },
  { project: 'MOB', title: 'Dark mode text unreadable on settings', description: 'Grey text on dark grey background in Settings.', severity: 'Medium', priority: 'Low', reporter: 'tester1', assignee: 'dev1', history: ['In Progress'], comments: [] },
];
