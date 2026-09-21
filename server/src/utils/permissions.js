import { ROLES } from './constants.js';

// ---------------------------------------------------------------------------
// Status workflow:  Open -> In Progress -> Testing -> Resolved -> Closed
// Extra rollbacks exist so a rejected fix is not a dead end:
//   Testing -> In Progress   (tester found the fix incomplete)
//   Resolved -> In Progress  (regression found after resolution)
// Closed is terminal, except Admin may reopen (Closed -> Open).
//
// Each transition lists the roles allowed to perform it.
//   Developer: works the issue (Open->In Progress->Testing).
//   Tester:    verifies (Testing->Resolved, Resolved->Closed) and can reject a fix.
//   Admin:     may perform any valid transition.
// The Developer must be the ASSIGNEE (checked in the service, not here).
// ---------------------------------------------------------------------------
export const TRANSITIONS = {
  Open: { 'In Progress': [ROLES.DEVELOPER, ROLES.ADMIN] },
  'In Progress': {
    Testing: [ROLES.DEVELOPER, ROLES.ADMIN],
    Open: [ROLES.DEVELOPER, ROLES.ADMIN],
  },
  Testing: {
    Resolved: [ROLES.TESTER, ROLES.ADMIN],
    'In Progress': [ROLES.TESTER, ROLES.ADMIN],
  },
  Resolved: {
    Closed: [ROLES.TESTER, ROLES.ADMIN],
    'In Progress': [ROLES.TESTER, ROLES.ADMIN],
  },
  Closed: { Open: [ROLES.ADMIN] },
};

export function nextStatuses(status, role) {
  const map = TRANSITIONS[status] || {};
  return Object.keys(map).filter((to) => map[to].includes(role));
}

export function checkTransition(from, to, role) {
  if (from === to) return { ok: false, reason: `Issue is already '${to}'` };
  const map = TRANSITIONS[from] || {};
  if (!map[to]) {
    const valid = Object.keys(map);
    return {
      ok: false,
      reason: `Invalid status transition: '${from}' -> '${to}'.` + (valid.length ? ` Allowed next statuses: ${valid.join(', ')}.` : ' This status has no further transitions.'),
    };
  }
  if (!map[to].includes(role)) {
    return { ok: false, forbidden: true, reason: `Role '${role}' cannot move an issue from '${from}' to '${to}'` };
  }
  return { ok: true };
}

// Project visibility: everyone (Admin included) only sees projects they created or belong to.
export const projectAccessFilter = (user) => ({
  $or: [{ members: user._id }, { createdBy: user._id }],
});

export const isProjectMember = (project, userId) =>
  project.members.some((m) => String(m._id || m) === String(userId)) || String(project.createdBy._id || project.createdBy) === String(userId);
