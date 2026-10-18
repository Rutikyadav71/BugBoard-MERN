export const ROLES = Object.freeze({ ADMIN: 'Admin', DEVELOPER: 'Developer', TESTER: 'Tester' });
export const ROLE_VALUES = Object.values(ROLES);

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const CATEGORIES = ['Bug', 'Feature', 'Improvement'];
export const STATUSES = ['Open', 'In Progress', 'Testing', 'Resolved', 'Closed'];

export const ACTIVITY_ACTIONS = [
  'issue_created',
  'status_changed',
  'assignee_changed',
  'priority_changed',
  'severity_changed',
  'category_changed',
  'component_changed',
  'due_date_changed',
  'title_changed',
  'description_changed',
  'issue_updated',
];
